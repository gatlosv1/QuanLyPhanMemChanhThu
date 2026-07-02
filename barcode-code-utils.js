(function (window) {
  'use strict';

  function normalizeText(value) {
    return String(value ?? '').trim().toUpperCase();
  }

  function normalizeLetters(value, fieldName, length) {
    const text = normalizeText(value).replace(/\s+/g, '');
    if (!text) {
      throw new Error(`${fieldName} không được để trống.`);
    }
    if (!new RegExp(`^[A-Z]{${length}}$`).test(text)) {
      throw new Error(`${fieldName} phải gồm đúng ${length} chữ cái.`);
    }
    return text;
  }

  function normalizeFixedDigits(value, fieldName, length) {
    const text = String(value ?? '').trim();
    if (!text) {
      throw new Error(`${fieldName} không được để trống.`);
    }
    if (!new RegExp(`^\\d{${length}}$`).test(text)) {
      throw new Error(`${fieldName} phải gồm đúng ${length} chữ số.`);
    }
    return text;
  }

  function normalizeDigits(value, fieldName, length) {
    const text = String(value ?? '').trim();
    if (!text) {
      throw new Error(`${fieldName} không được để trống.`);
    }
    if (!/^\d+$/.test(text)) {
      throw new Error(`${fieldName} phải gồm toàn chữ số.`);
    }
    if (text.length > length) {
      throw new Error(`${fieldName} không được dài hơn ${length} chữ số.`);
    }
    return text.padStart(length, '0');
  }

  function formatDatePart(value, fieldName, targetLength) {
    const text = String(value ?? '').trim();
    if (!text) {
      throw new Error(`${fieldName} không được để trống.`);
    }

    if (new RegExp(`^\\d{${targetLength}}$`).test(text)) {
      return text;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const [year, month, day] = text.split('-');
      if (targetLength === 6) {
        return `${day}${month}${year.slice(-2)}`;
      }
      return `${day}${month}`;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
      const [day, month, year] = text.split('/');
      if (targetLength === 6) {
        return `${day}${month}${year.slice(-2)}`;
      }
      return `${day}${month}`;
    }

    const parsedDate = new Date(text);
    if (!Number.isNaN(parsedDate.getTime())) {
      const day = String(parsedDate.getDate()).padStart(2, '0');
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const year = String(parsedDate.getFullYear()).slice(-2);
      if (targetLength === 6) {
        return `${day}${month}${year}`;
      }
      return `${day}${month}`;
    }

    throw new Error(`${fieldName} phải có định dạng ngày hợp lệ.`);
  }

  function toMod97NumericString(input) {
    const text = normalizeText(input).replace(/-/g, '');
    let numeric = '';

    for (const char of text) {
      if (/\d/.test(char)) {
        numeric += char;
        continue;
      }

      if (/[A-Z]/.test(char)) {
        numeric += String(char.charCodeAt(0) - 55);
        continue;
      }

      throw new Error(`Ký tự không hợp lệ trong mã: ${char}`);
    }

    return numeric;
  }

  function mod97FromNumericString(numericString) {
    let remainder = 0n;
    for (const digit of String(numericString)) {
      remainder = (remainder * 10n + BigInt(digit)) % 97n;
    }
    return remainder;
  }

  function calculateCheckDigit(baseCodeNoHyphen) {
    // Quy đổi chuỗi chữ/số sang dạng số thuần để MOD 97-10 có thể xử lý bằng BigInt.
    const numericSource = `${toMod97NumericString(baseCodeNoHyphen)}00`;
    const remainder = mod97FromNumericString(numericSource);
    const checkValue = 98n - remainder;

    // ISO 7064 MOD 97-10: nếu kết quả là 98 thì mã kiểm tra được biểu diễn là 00.
    if (checkValue === 98n) {
      return '00';
    }

    return String(checkValue).padStart(2, '0');
  }

  function buildBaseCode(parts) {
    const loaiSP = normalizeFixedDigits(parts.loaiSP ?? parts.LoaiSP ?? parts['LoạiSP'], 'LoạiSP', 3);
    const maNCC = normalizeDigits(parts.maNCC ?? parts.MaNCC ?? parts['MãNCC'], 'MãNCC', 2);
    const vungNL = normalizeLetters(parts.vungNL ?? parts.VungNL ?? parts['VùngNL'], 'VùngNL', 2);
    const ngaySX = formatDatePart(parts.ngaySX ?? parts.NgaySX ?? parts['NgàySX'], 'NgàySX', 6);
    const maXe = normalizeDigits(parts.maXe ?? parts.MaXe ?? parts['MãXe'], 'MãXe', 2);
    const ngayDG = formatDatePart(parts.ngayDG ?? parts.NgayDG ?? parts['NgàyĐG'], 'NgàyĐG', 4);
    const soThung = normalizeDigits(parts.soThung ?? parts.SoThung ?? parts['SốThùng'], 'SốThùng', 4);

    return `${loaiSP}-${maNCC}${vungNL}${ngaySX}-${maXe}-${ngayDG}-${soThung}`;
  }

  function generateFullCode(baseParts) {
    const baseCode = buildBaseCode(baseParts);
    const checkDigit = calculateCheckDigit(baseCode);
    return `${baseCode}-${checkDigit}`;
  }

  const REGION_TO_SCAN = {
    DN: 'N',
    MT: 'M',
    BP: 'P',
    DL: 'L'
  };

  const SCAN_TO_REGION = {
    N: 'DN',
    M: 'MT',
    P: 'BP',
    L: 'DL'
  };

  function toBase36(value, length) {
    return Number(value).toString(36).toUpperCase().padStart(length, '0');
  }

  function fromBase36(value) {
    return parseInt(String(value || '0'), 36);
  }

  function parseNgaySXDate(ngaySX) {
    const raw = normalizeDigits(ngaySX, 'NgàySX', 6);
    const day = parseInt(raw.slice(0, 2), 10);
    const month = parseInt(raw.slice(2, 4), 10);
    const year = 2000 + parseInt(raw.slice(4, 6), 10);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Error('NgàySX không hợp lệ.');
    }
    return date;
  }

  function encodeNgaySXCompact(ngaySX) {
    const baseDate = Date.UTC(2000, 0, 1);
    const targetDate = parseNgaySXDate(ngaySX).getTime();
    const diffDays = Math.round((targetDate - baseDate) / 86400000);
    return toBase36(diffDays, 3);
  }

  function decodeNgaySXCompact(value) {
    const diffDays = fromBase36(value);
    const date = new Date(Date.UTC(2000, 0, 1 + diffDays));
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = String(date.getUTCFullYear()).slice(-2);
    return `${day}${month}${year}`;
  }

  function encodeNgayDGCompact(ngayDG) {
    const raw = normalizeDigits(ngayDG, 'NgàyĐG', 4);
    const day = parseInt(raw.slice(0, 2), 10);
    const month = parseInt(raw.slice(2, 4), 10);
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      throw new Error('NgàyĐG không hợp lệ.');
    }
    return toBase36((month - 1) * 31 + (day - 1), 2);
  }

  function decodeNgayDGCompact(value) {
    const packed = fromBase36(value);
    const month = Math.floor(packed / 31) + 1;
    const day = (packed % 31) + 1;
    return `${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}`;
  }

  function normalizeParts(parts) {
    return {
      loaiSP: normalizeFixedDigits(parts.loaiSP ?? parts.LoaiSP ?? parts['LoạiSP'], 'LoạiSP', 3),
      maNCC: normalizeDigits(parts.maNCC ?? parts.MaNCC ?? parts['MãNCC'], 'MãNCC', 2),
      vungNL: normalizeLetters(parts.vungNL ?? parts.VungNL ?? parts['VùngNL'], 'VùngNL', 2),
      ngaySX: formatDatePart(parts.ngaySX ?? parts.NgaySX ?? parts['NgàySX'], 'NgàySX', 6),
      maXe: normalizeDigits(parts.maXe ?? parts.MaXe ?? parts['MãXe'], 'MãXe', 2),
      ngayDG: formatDatePart(parts.ngayDG ?? parts.NgayDG ?? parts['NgàyĐG'], 'NgàyĐG', 4),
      soThung: normalizeDigits(parts.soThung ?? parts.SoThung ?? parts['SốThùng'] ?? '0000', 'SốThùng', 4)
    };
  }

  function generateScanCode(baseParts) {
    const parts = normalizeParts(baseParts);
    const regionCode = REGION_TO_SCAN[parts.vungNL];
    if (!regionCode) {
      throw new Error('VùngNL không hỗ trợ cho mã quét rút gọn.');
    }

    // Mã quét rút gọn bỏ STT thùng để phù hợp quét trên tem 35x22mm.
    const body = `${parts.loaiSP}${parts.maNCC}${regionCode}${encodeNgaySXCompact(parts.ngaySX)}${parts.maXe}${encodeNgayDGCompact(parts.ngayDG)}`;
    const checkDigit = calculateCheckDigit(body);
    return `${body}${checkDigit}`;
  }

  function extractScanCode(scanCode) {
    const code = normalizeText(scanCode).replace(/\s+/g, '');
    const match = code.match(/^(\d{3})(\d{2})([NMPL])([0-9A-Z]{3})(\d{2})([0-9A-Z]{2})(\d{2})$/);
    if (!match) {
      return null;
    }

    const body = code.slice(0, -2);
    const checkDigit = code.slice(-2);
    const expected = calculateCheckDigit(body);
    if (expected !== checkDigit) {
      return null;
    }

    const vungNL = SCAN_TO_REGION[match[3]];
    if (!vungNL) {
      return null;
    }

    const ngaySX = decodeNgaySXCompact(match[4]);
    const ngayDG = decodeNgayDGCompact(match[6]);
    const baseCode = `${match[1]}-${match[2]}${vungNL}${ngaySX}-${match[5]}-${ngayDG}`;

    return {
      scanCode: code,
      fullCode: code,
      compactCode: code,
      baseCode,
      loaiSP: match[1],
      maNCC: match[2],
      vungNL,
      ngaySX,
      maXe: match[5],
      ngayDG,
      soThung: '',
      checkDigit
    };
  }

  function validateScanCode(scanCode) {
    const parsed = extractScanCode(scanCode);
    if (!parsed) {
      return {
        isValid: false,
        baseCode: '',
        error: 'Mã barcode rút gọn không đúng định dạng hoặc sai check digit.'
      };
    }

    return {
      isValid: true,
      baseCode: parsed.baseCode
    };
  }

  function toCompactCode(hyphenCode) {
    return normalizeText(hyphenCode).replace(/-/g, '');
  }

  function normalizeCodeInput(fullCode) {
    const code = normalizeText(fullCode).replace(/\s+/g, '');
    if (!code) return '';

    // Dạng mới gọn cho quét: bỏ toàn bộ dấu '-'.
    const compactMatch = code.match(/^(\d{3})(\d{2})([A-Z]{2})(\d{6})(\d{2})(\d{4})(\d{4})(\d{2})$/);
    if (compactMatch) {
      return `${compactMatch[1]}-${compactMatch[2]}${compactMatch[3]}${compactMatch[4]}-${compactMatch[5]}-${compactMatch[6]}-${compactMatch[7]}-${compactMatch[8]}`;
    }

    return code;
  }

  function extractParts(fullCode) {
    const code = normalizeCodeInput(fullCode);
    const match = code.match(/^(\d{3})-([0-9]{2})([A-Z]{2})(\d{6})-(\d{2})-(\d{4})-(\d{4})-(\d{2})$/);

    if (!match) {
      return null;
    }

    return {
      fullCode: code,
      compactCode: toCompactCode(code),
      baseCode: `${match[1]}-${match[2]}${match[3]}${match[4]}-${match[5]}-${match[6]}-${match[7]}`,
      loaiSP: match[1],
      maNCC: match[2],
      vungNL: match[3],
      ngaySX: match[4],
      maXe: match[5],
      ngayDG: match[6],
      soThung: match[7],
      checkDigit: match[8]
    };
  }

  function validateCode(fullCode) {
    try {
      const parsed = extractParts(fullCode);
      if (!parsed) {
        return {
          isValid: false,
          baseCode: '',
          error: 'Mã không đúng định dạng.'
        };
      }

      const expectedCheckDigit = calculateCheckDigit(parsed.baseCode);
      if (expectedCheckDigit !== parsed.checkDigit) {
        return {
          isValid: false,
          baseCode: parsed.baseCode,
          error: `Check digit không đúng. Mong đợi ${expectedCheckDigit}, nhận được ${parsed.checkDigit}.`
        };
      }

      return {
        isValid: true,
        baseCode: parsed.baseCode
      };
    } catch (error) {
      return {
        isValid: false,
        baseCode: '',
        error: error instanceof Error ? error.message : 'Không thể kiểm tra mã.'
      };
    }
  }

  const api = {
    generateFullCode,
    generateScanCode,
    validateScanCode,
    extractScanCode,
    validateCode,
    extractParts,
    normalizeCodeInput,
    toCompactCode,
    calculateCheckDigit,
    buildBaseCode
  };

  window.InternalBarcodeCode = api;
  window.generateFullCode = generateFullCode;
  window.generateScanCode = generateScanCode;
  window.validateScanCode = validateScanCode;
  window.extractScanCode = extractScanCode;
  window.validateCode = validateCode;
  window.extractParts = extractParts;
  window.normalizeCodeInput = normalizeCodeInput;
  window.toCompactCode = toCompactCode;
  window.calculateCheckDigit = calculateCheckDigit;
})(window);