import QRCode from 'qrcode';

// Server-side QR → SVG text. Pages show it with <img src="data:image/svg+xml,..."> (never innerHTML).
export function toSvg(text) {
  return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
}
