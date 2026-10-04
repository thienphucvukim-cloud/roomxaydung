// React's RSC wire format stores long strings as byte-counted T records.
// Replacing a detail ID inside streamed metadata must also update that count.
export function replaceRscShellTemplate(payload: string, marker: string, value: string) {
  if (!payload.includes(marker)) return payload;
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const bytes = encoder.encode(payload), records: string[] = [];
  const replace = (text: string) => text.split(marker).join(value);
  let offset = 0;
  while (offset < bytes.length) {
    const textHeader = decoder.decode(bytes.subarray(offset, Math.min(offset + 80, bytes.length))).match(/^([0-9a-f]+:T)([0-9a-f]+),/);
    if (textHeader) {
      const start = offset + textHeader[0].length;
      const end = start + Number.parseInt(textHeader[2], 16);
      if (end > bytes.length) throw new Error("Invalid RSC shell text record");
      const text = replace(decoder.decode(bytes.subarray(start, end)));
      records.push(textHeader[1] + encoder.encode(text).length.toString(16) + "," + text);
      offset = end;
    } else {
      const newline = bytes.indexOf(10, offset);
      const end = newline < 0 ? bytes.length : newline + 1;
      records.push(replace(decoder.decode(bytes.subarray(offset, end))));
      offset = end;
    }
  }
  return records.join("");
}
