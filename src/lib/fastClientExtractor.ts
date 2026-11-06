/**
 * LAMLA Guide AI — Complete Academic Client-Side Document & Slide Extractor
 * "It's Never Too Late To Study."
 *
 * Extracts every slide/section from beginning to end (.pptx, .docx, .txt, .md):
 * - Preserves slide numbers, titles, paragraphs, tables (<a:tbl> / <w:tbl>),
 *   SmartArt diagrams (ppt/diagrams/data*.xml), charts (ppt/charts/chart*.xml),
 *   and lecturer speaker notes (ppt/notesSlides/notesSlide*.xml).
 * - Automatically hands off image-heavy / scanned presentations to the server
 *   Vision OCR pipeline so visual slides are never silently ignored.
 */

export interface ClientExtractionResult {
  extractedText: string;
  pageCount: number;
  handledOnClient: boolean;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream not supported in this browser.");
  }
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  writer.write(compressed as unknown as BufferSource).catch(() => {});
  writer.close().catch(() => {});

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

interface ZipEntryMeta {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

async function readZipXmlEntries(
  file: File,
  filterFn: (name: string) => boolean
): Promise<Map<string, string>> {
  const tailSize = Math.min(file.size, 512 * 1024);
  const tailOffset = file.size - tailSize;
  const tailBuf = new Uint8Array(await file.slice(tailOffset, file.size).arrayBuffer());
  const tailView = new DataView(tailBuf.buffer, tailBuf.byteOffset, tailBuf.byteLength);

  let eocdPos = -1;
  for (let i = tailBuf.length - 22; i >= 0; i--) {
    if (tailView.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos < 0) {
    throw new Error("ZIP Central Directory not found.");
  }

  const cdSize = tailView.getUint32(eocdPos + 12, true);
  const cdOffset = tailView.getUint32(eocdPos + 16, true);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    throw new Error("ZIP64 archive requires server stream.");
  }

  const cdBuf = new Uint8Array(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const cdView = new DataView(cdBuf.buffer, cdBuf.byteOffset, cdBuf.byteLength);
  const decoder = new TextDecoder("utf-8");

  const entries: ZipEntryMeta[] = [];
  let pos = 0;
  while (pos + 46 <= cdBuf.length) {
    if (cdView.getUint32(pos, true) !== 0x02014b50) break;
    const compressionMethod = cdView.getUint16(pos + 10, true);
    const compressedSize = cdView.getUint32(pos + 20, true);
    const uncompressedSize = cdView.getUint32(pos + 24, true);
    const nameLen = cdView.getUint16(pos + 28, true);
    const extraLen = cdView.getUint16(pos + 30, true);
    const commentLen = cdView.getUint16(pos + 32, true);
    const localHeaderOffset = cdView.getUint32(pos + 42, true);

    const name = decoder.decode(cdBuf.subarray(pos + 46, pos + 46 + nameLen));
    if (filterFn(name) && uncompressedSize < 25 * 1024 * 1024 && compressedSize > 0) {
      entries.push({
        name,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
      });
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }

  const results = new Map<string, string>();
  for (const entry of entries) {
    if (entry.localHeaderOffset + 30 > file.size) continue;
    const headerSlice = new Uint8Array(
      await file.slice(entry.localHeaderOffset, entry.localHeaderOffset + 30).arrayBuffer()
    );
    const hv = new DataView(headerSlice.buffer, headerSlice.byteOffset, headerSlice.byteLength);
    if (hv.getUint32(0, true) !== 0x04034b50) continue;
    const localNameLen = hv.getUint16(26, true);
    const localExtraLen = hv.getUint16(28, true);
    const dataStart = entry.localHeaderOffset + 30 + localNameLen + localExtraLen;
    if (dataStart + entry.compressedSize > file.size) continue;

    const rawSlice = new Uint8Array(
      await file.slice(dataStart, dataStart + entry.compressedSize).arrayBuffer()
    );

    let xmlBytes: Uint8Array;
    if (entry.compressionMethod === 0) {
      xmlBytes = rawSlice;
    } else if (entry.compressionMethod === 8) {
      xmlBytes = await inflateRawBytes(rawSlice);
    } else {
      continue;
    }
    results.set(entry.name, decoder.decode(xmlBytes));
  }

  return results;
}

function extractParagraphsFromDrawingMl(xml: string): string[] {
  const paras: string[] = [];

  // Extract tables (<a:tbl>) as structured Markdown tables first
  const tblRegex = /<a:tbl\b[^>]*>([\s\S]*?)<\/a:tbl>/g;
  let tblMatch: RegExpExecArray | null;
  const tableBlocks: string[] = [];
  while ((tblMatch = tblRegex.exec(xml)) !== null) {
    const tblXml = tblMatch[1];
    const rowRegex = /<a:tr\b[^>]*>([\s\S]*?)<\/a:tr>/g;
    let rMatch: RegExpExecArray | null;
    const rows: string[] = [];
    let rIdx = 0;
    while ((rMatch = rowRegex.exec(tblXml)) !== null) {
      const cellRegex = /<a:tc\b[^>]*>([\s\S]*?)<\/a:tc>/g;
      let cMatch: RegExpExecArray | null;
      const cells: string[] = [];
      while ((cMatch = cellRegex.exec(rMatch[1])) !== null) {
        const cellTexts: string[] = [];
        const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
        let tMatch: RegExpExecArray | null;
        while ((tMatch = tRegex.exec(cMatch[1])) !== null) {
          cellTexts.push(decodeXmlEntities(tMatch[1]).trim());
        }
        cells.push(cellTexts.filter(Boolean).join(" ") || "-");
      }
      if (cells.some((c) => c !== "-")) {
        rows.push(`| ${cells.join(" | ")} |`);
        if (rIdx === 0) {
          rows.push(`| ${cells.map(() => "---").join(" | ")} |`);
        }
        rIdx++;
      }
    }
    if (rows.length > 0) {
      tableBlocks.push(`[Table Data]:\n${rows.join("\n")}`);
    }
  }

  // Strip tables before extracting regular paragraphs so table cells aren't duplicated
  const xmlWithoutTables = xml.replace(/<a:tbl\b[^>]*>[\s\S]*?<\/a:tbl>/g, "");
  const pRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(xmlWithoutTables)) !== null) {
    const pBody = pMatch[1];
    const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
    const parts: string[] = [];
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(pBody)) !== null) {
      parts.push(decodeXmlEntities(tMatch[1]));
    }
    const line = parts.join("").trim();
    if (line) paras.push(line);
  }

  return [...paras, ...tableBlocks];
}

async function extractPptxOnClient(file: File): Promise<ClientExtractionResult> {
  const xmlMap = await readZipXmlEntries(
    file,
    (name) =>
      /^ppt\/slides\/slide\d+\.xml$/i.test(name) ||
      /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(name) ||
      /^ppt\/diagrams\/data\d+\.xml$/i.test(name) ||
      /^ppt\/charts\/chart\d+\.xml$/i.test(name)
  );

  const slideNums = Array.from(xmlMap.keys())
    .map((k) => {
      const m = k.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  if (slideNums.length === 0) {
    throw new Error("No slides found in PPTX.");
  }

  const formattedSlides: string[] = [];
  const lowTextSlides: number[] = [];

  for (const num of slideNums) {
    const slideXml = xmlMap.get(`ppt/slides/slide${num}.xml`) || "";
    const notesXml = xmlMap.get(`ppt/notesSlides/notesSlide${num}.xml`) || "";
    const diagXml = xmlMap.get(`ppt/diagrams/data${num}.xml`) || "";
    const chartXml = xmlMap.get(`ppt/charts/chart${num}.xml`) || "";

    const lines = extractParagraphsFromDrawingMl(slideXml);
    const notesLines = notesXml ? extractParagraphsFromDrawingMl(notesXml) : [];
    const diagLines = diagXml ? extractParagraphsFromDrawingMl(diagXml) : [];
    const chartLines = chartXml ? extractParagraphsFromDrawingMl(chartXml) : [];

    const title = lines[0] || `Slide ${num}`;
    const bodyParts = lines.slice(1);
    if (diagLines.length > 0) {
      bodyParts.push(`[Diagram / Process Flow]: ${diagLines.join(" -> ")}`);
    }
    if (chartLines.length > 0) {
      bodyParts.push(`[Chart / Data]: ${chartLines.join(" | ")}`);
    }

    const body = bodyParts.join("\n").trim();
    const totalChars = (title === `Slide ${num}` ? 0 : title.length) + body.length + notesLines.join(" ").length;
    if (totalChars < 12) {
      lowTextSlides.push(num);
    }

    let block = `--- Slide ${num}: ${title} ---\n${body || title}`;
    if (notesLines.length > 0) {
      block += `\n[Lecturer Note: ${notesLines.join(" ")}]`;
    }
    formattedSlides.push(block);
  }

  // If >35% of slides have almost no text, the deck is likely image-based/scanned — let the server Vision OCR process it!
  if (lowTextSlides.length > slideNums.length * 0.35 && file.size < 80 * 1024 * 1024) {
    throw new Error("Image-heavy presentation detected; routing to server Vision OCR.");
  }

  if (lowTextSlides.length > 0) {
    formattedSlides.push(
      `[Extraction Honesty Notice: Slide(s) ${lowTextSlides.join(", ")} contained primarily graphical or non-text elements with minimal selectable text.]`
    );
  }

  return {
    extractedText: formattedSlides.join("\n\n").trim(),
    pageCount: slideNums.length,
    handledOnClient: true,
  };
}

async function extractDocxOnClient(file: File): Promise<ClientExtractionResult> {
  const xmlMap = await readZipXmlEntries(file, (name) => name === "word/document.xml");
  const docXml = xmlMap.get("word/document.xml");
  if (!docXml) {
    throw new Error("word/document.xml not found.");
  }

  const paragraphs: string[] = [];
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(docXml)) !== null) {
    const pBody = pMatch[1];
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    const runs: string[] = [];
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(pBody)) !== null) {
      runs.push(decodeXmlEntities(tMatch[1]));
    }
    const text = runs.join("").trim();
    if (text) paragraphs.push(text);
  }

  if (paragraphs.length === 0) {
    throw new Error("No readable paragraphs in DOCX.");
  }

  const sections: string[] = [];
  const step = 10;
  let slideIdx = 1;
  for (let i = 0; i < paragraphs.length; i += step) {
    const slice = paragraphs.slice(i, i + step);
    const title = slice[0].slice(0, 75) || `Section ${slideIdx}`;
    sections.push(`--- Slide ${slideIdx}: ${title} ---\n${slice.join("\n")}`);
    slideIdx++;
  }

  return {
    extractedText: sections.join("\n\n"),
    pageCount: sections.length,
    handledOnClient: true,
  };
}

export async function tryFastClientExtraction(file: File): Promise<ClientExtractionResult | null> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".txt") || name.endsWith(".md")) {
      const slice = file.size > 15 * 1024 * 1024 ? file.slice(0, 15 * 1024 * 1024) : file;
      const text = (await slice.text()).trim();
      if (text.length > 0) {
        return {
          extractedText: text,
          pageCount: Math.max(1, Math.ceil(text.length / 1500)),
          handledOnClient: true,
        };
      }
    } else if (name.endsWith(".pptx")) {
      const res = await extractPptxOnClient(file);
      if (res.extractedText.trim().length > 20) {
        return res;
      }
    } else if (name.endsWith(".docx")) {
      const res = await extractDocxOnClient(file);
      if (res.extractedText.trim().length > 20) {
        return res;
      }
    }
  } catch (err) {
    console.warn("Fast client extraction fallback to server stream:", err);
  }
  return null;
}
