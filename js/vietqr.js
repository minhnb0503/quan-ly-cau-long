const VietQR = (() => {
  const BANKS = [
    { id: '970422', name: 'MB Bank', shortName: 'MB' },
    { id: '970436', name: 'Vietcombank', shortName: 'VCB' },
    { id: '970407', name: 'Techcombank', shortName: 'TCB' },
    { id: '970415', name: 'VietinBank', shortName: 'CTG' },
    { id: '970418', name: 'BIDV', shortName: 'BIDV' },
    { id: '970416', name: 'ACB', shortName: 'ACB' },
    { id: '970432', name: 'VPBank', shortName: 'VPB' },
    { id: '970423', name: 'TPBank', shortName: 'TPB' },
    { id: '970448', name: 'OCB', shortName: 'OCB' },
    { id: '970405', name: 'Agribank', shortName: 'AGR' },
    { id: '970403', name: 'Sacombank', shortName: 'STB' },
    { id: '970441', name: 'VIB', shortName: 'VIB' },
    { id: '970443', name: 'SHB', shortName: 'SHB' },
    { id: '970454', name: 'Việt Capital Bank', shortName: 'BVB' },
    { id: '970449', name: 'LPBank', shortName: 'LPB' },
    { id: '970431', name: 'Eximbank', shortName: 'EIB' },
    { id: '970426', name: 'MSB', shortName: 'MSB' },
    { id: '970452', name: 'KienlongBank', shortName: 'KLB' }
  ];

  const crc16 = (data) => {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) > 0) crc = (crc << 1) ^ 0x1021;
        else crc = crc << 1;
      }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  };

  const padField = (id, val) => {
    return id + String(val.length).padStart(2, '0') + val;
  };

  const generateQRString = (amount, content, configOverride = null) => {
    const config = configOverride || getConfig();
    if (!config || !config.bankId || !config.accountNo) return '';
    
    let payload = '';
    payload += padField('00', '01'); 
    payload += padField('01', '12'); 
    
    const guid = padField('00', 'A000000727');
    const network = padField('01', padField('00', config.bankId) + padField('01', config.accountNo));
    const service = padField('02', '08VNPAYQR');
    const merchant = padField('38', guid + network + service);
    payload += merchant;

    payload += padField('53', '704'); 
    if (amount) payload += padField('54', String(amount)); 
    payload += padField('58', 'VN'); 
    
    if (content) {
      payload += padField('62', padField('08', content)); 
    }

    payload += '6304';
    payload += crc16(payload);
    
    return payload;
  };

  const getConfig = () => {
    try {
      const config = JSON.parse(localStorage.getItem('clp_vietqr_config'));
      return config && typeof config === 'object' ? config : null;
    } catch { return null; }
  };
  const saveConfig = (bankOrConfig, accountNo, accountName) => {
    const config = typeof bankOrConfig === 'object'
      ? bankOrConfig
      : { bankId: bankOrConfig, accountNo, accountName };
    localStorage.setItem('clp_vietqr_config', JSON.stringify(config));
  };
  const hasConfig = () => {
    const config = getConfig();
    return Boolean(config?.bankId && config?.accountNo && config?.accountName);
  };

  // ----- MINIMAL QR ENCODER START -----
  // Uses Byte Mode only, Error Correction Level M
  class QRBitBuffer {
    constructor() {
      this.buffer = [];
      this.length = 0;
    }
    get(index) {
      return ((this.buffer[Math.floor(index / 8)] >>> (7 - (index % 8))) & 1) === 1;
    }
    put(num, length) {
      for (let i = 0; i < length; i++) {
        this.putBit(((num >>> (length - i - 1)) & 1) === 1);
      }
    }
    putBit(bit) {
      const bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) {
        this.buffer.push(0);
      }
      if (bit) {
        this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      }
      this.length++;
    }
  }

  class QRPolynomial {
    constructor(num, shift) {
      let offset = 0;
      while (offset < num.length && num[offset] === 0) {
        offset++;
      }
      this.num = new Array(num.length - offset + shift);
      for (let i = 0; i < num.length - offset; i++) {
        this.num[i] = num[i + offset];
      }
      for (let i = 0; i < shift; i++) {
        this.num[this.num.length - shift + i] = 0;
      }
    }
    get(index) {
      return this.num[index];
    }
    getLength() {
      return this.num.length;
    }
    multiply(e) {
      const num = new Array(this.getLength() + e.getLength() - 1);
      for (let i = 0; i < num.length; i++) num[i] = 0;
      for (let i = 0; i < this.getLength(); i++) {
        for (let j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new QRPolynomial(num, 0);
    }
    mod(e) {
      if (this.getLength() - e.getLength() < 0) {
        return this;
      }
      const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      const num = [...this.num];
      for (let i = 0; i < e.getLength(); i++) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      }
      return new QRPolynomial(num, 0).mod(e);
    }
  }

  const QRMath = {
    glog: function(n) {
      if (n < 1) throw new Error("glog(" + n + ")");
      return QRMath.LOG_TABLE[n];
    },
    gexp: function(n) {
      while (n < 0) n += 255;
      while (n >= 256) n -= 255;
      return QRMath.EXP_TABLE[n];
    },
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256)
  };
  for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (let i = 8; i < 256; i++) {
    QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
  }
  for (let i = 0; i < 255; i++) {
    QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
  }

  // ECL M capacities for versions 1-15 (enough for ~300 bytes)
  const ECL_M_INFO = [
    { v: 1,  data: 16,  ec: 10, blocks: 1,  b1: 16,  b2: 0,   a1: 1, a2: 0 },
    { v: 2,  data: 28,  ec: 16, blocks: 1,  b1: 28,  b2: 0,   a1: 1, a2: 0 },
    { v: 3,  data: 44,  ec: 26, blocks: 1,  b1: 44,  b2: 0,   a1: 1, a2: 0 },
    { v: 4,  data: 64,  ec: 36, blocks: 2,  b1: 32,  b2: 0,   a1: 2, a2: 0 },
    { v: 5,  data: 86,  ec: 48, blocks: 2,  b1: 43,  b2: 0,   a1: 2, a2: 0 },
    { v: 6,  data: 108, ec: 64, blocks: 4,  b1: 27,  b2: 0,   a1: 4, a2: 0 },
    { v: 7,  data: 130, ec: 66, blocks: 4,  b1: 31,  b2: 32,  a1: 4, a2: 0 }, // Simplified slightly for dynamic code block counts
    { v: 8,  data: 192, ec: 86, blocks: 4,  b1: 47,  b2: 48,  a1: 2, a2: 2 },
    { v: 9,  data: 230, ec: 110,blocks: 5,  b1: 45,  b2: 46,  a1: 3, a2: 2 },
    { v: 10, data: 271, ec: 136,blocks: 5,  b1: 54,  b2: 55,  a1: 4, a2: 1 },
    { v: 11, data: 321, ec: 160,blocks: 5,  b1: 64,  b2: 65,  a1: 4, a2: 1 },
    { v: 12, data: 367, ec: 192,blocks: 8,  b1: 45,  b2: 46,  a1: 2, a2: 6 },
    { v: 13, data: 425, ec: 224,blocks: 9,  b1: 47,  b2: 48,  a1: 4, a2: 5 },
    { v: 14, data: 458, ec: 224,blocks: 9,  b1: 50,  b2: 51,  a1: 4, a2: 5 },
    { v: 15, data: 520, ec: 272,blocks: 10, b1: 52,  b2: 53,  a1: 5, a2: 5 }
  ];

  const getErrorCorrectPolynomial = (errorCorrectLength) => {
    let a = new QRPolynomial([1], 0);
    for (let i = 0; i < errorCorrectLength; i++) {
      a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
    }
    return a;
  };

  const ALIGNMENT_PATTERN = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38],
    [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58],
    [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74]
  ];

  class QRCode {
    constructor(data) {
      this.data = data;
      this.version = 1;
      let dataLen = data.length;
      
      for (let i = 0; i < ECL_M_INFO.length; i++) {
        const headerBits = 4 + (i < 9 ? 8 : 16);
        const totalBits = headerBits + dataLen * 8 + 4;
        if (totalBits <= ECL_M_INFO[i].data * 8) {
          this.version = i + 1;
          break;
        }
      }
      this.ecInfo = ECL_M_INFO[this.version - 1];
      this.moduleCount = this.version * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (let row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount);
      }
    }
    
    make() {
      const buffer = new QRBitBuffer();
      buffer.put(4, 4);
      buffer.put(this.data.length, this.version < 10 ? 8 : 16);
      
      const encoder = new TextEncoder();
      const utf8Data = encoder.encode(this.data);
      for (let i = 0; i < utf8Data.length; i++) {
        buffer.put(utf8Data[i], 8);
      }
      
      if (buffer.length + 4 <= this.ecInfo.data * 8) {
        buffer.put(0, 4);
      }
      while (buffer.length % 8 !== 0) {
        buffer.putBit(false);
      }
      while (true) {
        if (buffer.length >= this.ecInfo.data * 8) break;
        buffer.put(0xEC, 8);
        if (buffer.length >= this.ecInfo.data * 8) break;
        buffer.put(0x11, 8);
      }
      
      this.createModules(buffer);
    }
    
    createModules(buffer) {
      for (let row = 0; row < this.moduleCount; row++) {
        for (let col = 0; col < this.moduleCount; col++) {
          this.modules[row][col] = null;
        }
      }
      
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupPositionAdjustPattern();
      this.setupTimingPattern();
      this.setupTypeInfo(true, 0); 
      
      if (this.version >= 7) {
        this.setupTypeNumber(true);
      }
      
      const dataBytes = buffer.buffer;
      const dataWithEC = this.createECData(dataBytes);
      this.mapData(dataWithEC, 0);
    }
    
    createECData(dataBytes) {
      const rsBlocks = [];
      let offset = 0;
      
      for (let i = 0; i < this.ecInfo.a1; i++) {
        rsBlocks.push({
          dataCount: this.ecInfo.b1,
          data: dataBytes.slice(offset, offset + this.ecInfo.b1)
        });
        offset += this.ecInfo.b1;
      }
      for (let i = 0; i < this.ecInfo.a2; i++) {
        rsBlocks.push({
          dataCount: this.ecInfo.b2,
          data: dataBytes.slice(offset, offset + this.ecInfo.b2)
        });
        offset += this.ecInfo.b2;
      }
      
      let ecLength = Math.floor(this.ecInfo.ec / (this.ecInfo.a1 + this.ecInfo.a2));
      const ecBlocks = [];
      const rsPoly = getErrorCorrectPolynomial(ecLength);
      
      for (let i = 0; i < rsBlocks.length; i++) {
        const rawData = rsBlocks[i].data;
        const rawPoly = new QRPolynomial(rawData, rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);
        const ecData = new Array(rsPoly.getLength() - 1);
        for (let j = 0; j < ecData.length; j++) {
          const modIndex = j + modPoly.getLength() - ecData.length;
          ecData[j] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
        }
        ecBlocks.push(ecData);
      }
      
      let totalData = 0, totalEC = 0;
      for (let i = 0; i < rsBlocks.length; i++) {
        totalData += rsBlocks[i].dataCount;
        totalEC += ecBlocks[i].length;
      }
      
      const out = new Array(totalData + totalEC);
      let index = 0;
      
      let maxData = 0;
      for (let i = 0; i < rsBlocks.length; i++) maxData = Math.max(maxData, rsBlocks[i].dataCount);
      
      for (let i = 0; i < maxData; i++) {
        for (let j = 0; j < rsBlocks.length; j++) {
          if (i < rsBlocks[j].dataCount) {
            out[index++] = rsBlocks[j].data[i];
          }
        }
      }
      
      let maxEC = 0;
      for (let i = 0; i < rsBlocks.length; i++) maxEC = Math.max(maxEC, ecBlocks[i].length);
      
      for (let i = 0; i < maxEC; i++) {
        for (let j = 0; j < rsBlocks.length; j++) {
          if (i < ecBlocks[j].length) {
            out[index++] = ecBlocks[j][i];
          }
        }
      }
      return out;
    }
    
    setupPositionProbePattern(row, col) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          if (row + r <= -1 || this.moduleCount <= row + r || col + c <= -1 || this.moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c === 0 || c === 6)) || (0 <= c && c <= 6 && (r === 0 || r === 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    }
    
    setupPositionAdjustPattern() {
      const pos = ALIGNMENT_PATTERN[this.version - 1] || [];
      for (let i = 0; i < pos.length; i++) {
        for (let j = 0; j < pos.length; j++) {
          const row = pos[i];
          const col = pos[j];
          if (this.modules[row][col] !== null) continue;
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
                this.modules[row + r][col + c] = true;
              } else {
                this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    }
    
    setupTimingPattern() {
      for (let r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] === null) this.modules[r][6] = (r % 2 === 0);
      }
      for (let c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] === null) this.modules[6][c] = (c % 2 === 0);
      }
    }
    
    setupTypeNumber(test) {
      const bits = QRMath.BCHTypeNumber(this.version);
      for (let i = 0; i < 18; i++) {
        const mod = (!test && ((bits >> i) & 1) === 1);
        this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
      }
      for (let i = 0; i < 18; i++) {
        const mod = (!test && ((bits >> i) & 1) === 1);
        this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    }
    
    setupTypeInfo(test, maskPattern) {
      const data = (0 << 3) | maskPattern;
      const bits = QRMath.BCHTypeInfo(data);
      
      for (let i = 0; i < 15; i++) {
        const mod = (!test && ((bits >> i) & 1) === 1);
        
        if (i < 6) this.modules[i][8] = mod;
        else if (i < 8) this.modules[i + 1][8] = mod;
        else this.modules[this.moduleCount - 15 + i][8] = mod;
      }
      
      for (let i = 0; i < 15; i++) {
        const mod = (!test && ((bits >> i) & 1) === 1);
        if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
        else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
        else this.modules[8][15 - i - 1] = mod;
      }
      this.modules[this.moduleCount - 8][8] = !test;
    }
    
    mapData(data, maskPattern) {
      let inc = -1;
      let row = this.moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      
      for (let col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        while (true) {
          for (let c = 0; c < 2; c++) {
            if (this.modules[row][col - c] === null) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
              }
              const mask = (row + col - c) % 2 === 0;
              if (mask) dark = !dark;
              this.modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex === -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
      
      this.setupTypeInfo(false, maskPattern);
    }
  }

  QRMath.BCHTypeInfo = (data) => {
    let d = data << 10;
    while ((QRMath.getBCHDigit(d) - QRMath.getBCHDigit(0x537)) >= 0) {
      d ^= (0x537 << (QRMath.getBCHDigit(d) - QRMath.getBCHDigit(0x537)));
    }
    return ((data << 10) | d) ^ 0x5412;
  };

  QRMath.BCHTypeNumber = (data) => {
    let d = data << 12;
    while ((QRMath.getBCHDigit(d) - QRMath.getBCHDigit(0x1F25)) >= 0) {
      d ^= (0x1F25 << (QRMath.getBCHDigit(d) - QRMath.getBCHDigit(0x1F25)));
    }
    return (data << 12) | d;
  };

  QRMath.getBCHDigit = (data) => {
    let digit = 0;
    while (data !== 0) {
      digit++;
      data >>>= 1;
    }
    return digit;
  };

  // ----- MINIMAL QR ENCODER END -----

  const renderQR = (containerEl, { amount, playerName, sessionDate, size = 200, config = null }) => {
    const qrString = generateQRString(amount, `Chuyen tien cau long ${playerName || ''} ${sessionDate || ''}`.trim(), config);
    
    containerEl.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Draw white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    if (qrString) {
      try {
        const qr = new QRCode(qrString);
        qr.make();
        const modules = qr.modules;
        const modCount = qr.moduleCount;
        
        // Add quiet zone (4 modules)
        const quietZone = 4;
        const totalMod = modCount + quietZone * 2;
        const modSize = size / totalMod;
        
        ctx.fillStyle = '#000000';
        for (let row = 0; row < modCount; row++) {
          for (let col = 0; col < modCount; col++) {
            if (modules[row][col]) {
              ctx.fillRect(
                (col + quietZone) * modSize,
                (row + quietZone) * modSize,
                modSize + 0.5,
                modSize + 0.5
              );
            }
          }
        }
      } catch (err) {
        ctx.fillStyle = '#000000';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Lỗi tạo QR: ' + err.message, size/2, size/2);
      }
    } else {
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Chưa cấu hình tài khoản', size/2, size/2);
    }
    
    containerEl.appendChild(canvas);
    return canvas;
  };

  const createPaymentCard = ({ amount, playerName, sessionDate }) => {
    const config = getConfig();
    if (!config) return null;

    const bank = BANKS.find(b => b.id === config.bankId) || { name: 'Bank' };
    
    const card = document.createElement('div');
    card.className = 'vietqr-card';
    card.style.cssText = `
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      max-width: 300px;
      margin: 0 auto;
    `;

    const qrContainer = document.createElement('div');
    qrContainer.style.background = '#fff';
    qrContainer.style.padding = '12px';
    qrContainer.style.borderRadius = '12px';
    
    renderQR(qrContainer, { amount, playerName, sessionDate, size: 200 });
    
    const info = document.createElement('div');
    info.style.textAlign = 'center';
    info.style.width = '100%';
    const amountText = document.createElement('div');
    amountText.style.cssText = 'font-size:24px;font-weight:700;color:#087f6f;margin-bottom:8px';
    amountText.textContent = amount ? amount.toLocaleString('vi-VN') + ' đ' : 'Chưa có số tiền';
    const accountText = document.createElement('div');
    accountText.style.cssText = 'font-size:14px;color:#52657a;margin-bottom:4px';
    accountText.textContent = `${bank.name} - ${config.accountNo}`;
    const ownerText = document.createElement('div');
    ownerText.style.cssText = 'font-size:16px;font-weight:600;color:#263b53';
    ownerText.textContent = config.accountName;
    info.append(amountText, accountText, ownerText);

    card.appendChild(qrContainer);
    card.appendChild(info);
    
    return card;
  };

  return {
    BANKS,
    saveConfig,
    getConfig,
    hasConfig,
    generateQRString,
    renderQR,
    createPaymentCard
  };
})();
