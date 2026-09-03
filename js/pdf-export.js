const PDFExport = (() => {
  // Helper: Format Money
  const formatMoney = (amount) => {
    return amount.toLocaleString('vi-VN') + ' ₫';
  };

  // Helper: Draw Rounded Rect
  const drawRoundedRect = (ctx, x, y, w, h, r, fill, stroke) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  };

  // Helper: Draw Dashed Line
  const drawDashedLine = (ctx, x1, y1, x2, y2, dashArray) => {
    ctx.beginPath();
    ctx.setLineDash(dashArray || [10, 10]);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Helper: Wrap Text
  const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    
    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
  };

  // Helper: Draw Progress Bar
  const drawProgressBar = (ctx, x, y, w, h, progress, bg, fill) => {
    drawRoundedRect(ctx, x, y, w, h, h/2, bg);
    if (progress > 0) {
      drawRoundedRect(ctx, x, y, w * progress, h, h/2, fill);
    }
  };

  // Helper: Load Image
  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  // Create iframe for printing
  const createPrintIframe = (htmlContent) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();
    
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  // Generate Receipt Canvas (Shared logic)
  const createReceiptCanvas = async (data, qrConfig = null) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 1080;
    
    // Calculate height dynamically
    let height = 600 + (data.players ? data.players.length * 80 : 0);
    if (qrConfig) height += 500;
    
    canvas.width = width;
    canvas.height = height;
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Top Gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, 120);
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px "Be Vietnam Pro"';
    ctx.textAlign = 'center';
    ctx.fillText('BIÊN LAI CHI PHÍ CẦU LÔNG 🏸', width / 2, 80);
    
    // Date & Mode Badge
    drawRoundedRect(ctx, width/2 - 250, 150, 500, 70, 35, '#f1f5f9', '#e2e8f0');
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 32px "Be Vietnam Pro"';
    const modeText = data.mode === 'home' ? 'Sân Nhà' : 'Giao Lưu';
    ctx.fillText(`${data.dateDisplay} • ${modeText}`, width/2, 198);
    
    // Court
    if (data.courtName) {
      ctx.font = '600 28px "Be Vietnam Pro"';
      ctx.fillStyle = '#64748b';
      ctx.fillText(data.courtName, width/2, 260);
    }
    
    // Costs
    let currentY = 330;
    ctx.textAlign = 'left';
    ctx.font = 'bold 36px "Be Vietnam Pro"';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('CHI PHÍ', 80, currentY);
    
    currentY += 60;
    ctx.font = '600 32px "Be Vietnam Pro"';
    ctx.fillStyle = '#475569';
    ctx.fillText('Sân:', 80, currentY);
    ctx.textAlign = 'right';
    ctx.fillText(formatMoney(data.tienSan || 0), width - 80, currentY);
    
    currentY += 50;
    ctx.textAlign = 'left';
    ctx.fillText('Cầu:', 80, currentY);
    ctx.textAlign = 'right';
    ctx.fillText(formatMoney(data.tienCau || 0), width - 80, currentY);
    
    currentY += 40;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    drawDashedLine(ctx, 80, currentY, width - 80, currentY, [15, 15]);
    
    currentY += 60;
    ctx.font = 'bold 40px "Be Vietnam Pro"';
    ctx.fillStyle = '#6366f1';
    ctx.textAlign = 'left';
    ctx.fillText('TỔNG CỘNG:', 80, currentY);
    ctx.textAlign = 'right';
    ctx.fillText(formatMoney(data.totalCost || 0), width - 80, currentY);
    
    // Players
    if (data.players && data.players.length > 0) {
      currentY += 100;
      ctx.textAlign = 'left';
      ctx.font = 'bold 36px "Be Vietnam Pro"';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('THÀNH VIÊN', 80, currentY);
      
      currentY += 40;
      data.players.forEach(p => {
        currentY += 80;
        
        // Background for row
        drawRoundedRect(ctx, 60, currentY - 55, width - 120, 80, 20, p.paid ? '#f0fdf4' : '#fff1f2', p.paid ? '#bbf7d0' : '#fecdd3');
        
        ctx.font = 'bold 32px "Be Vietnam Pro"';
        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'left';
        
        const icon = p.paid ? '✅' : '❌';
        ctx.fillText(`${icon} ${p.name}`, 90, currentY);
        
        ctx.textAlign = 'right';
        ctx.font = 'bold 32px "Be Vietnam Pro"';
        ctx.fillStyle = p.paid ? '#16a34a' : '#e11d48';
        ctx.fillText(formatMoney(p.amount || 0), width - 90, currentY);
      });
      
      // Progress
      currentY += 80;
      const paidCount = data.players.filter(p => p.paid).length;
      const totalCount = data.players.length;
      const progress = totalCount > 0 ? paidCount / totalCount : 0;
      
      drawProgressBar(ctx, 80, currentY, width - 160, 24, progress, '#e2e8f0', '#6366f1');
      
      currentY += 50;
      ctx.font = '600 28px "Be Vietnam Pro"';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText(`Đã thu ${paidCount}/${totalCount} (${formatMoney(data.totalCollected || 0)})`, width/2, currentY);
    }
    
    // QR Code
    if (qrConfig && qrConfig.qrUrl) {
      currentY += 80;
      try {
        const qrImg = await loadImage(qrConfig.qrUrl);
        const qrSize = 400;
        ctx.drawImage(qrImg, width/2 - qrSize/2, currentY, qrSize, qrSize);
        
        currentY += qrSize + 50;
        ctx.font = 'bold 32px "Be Vietnam Pro"';
        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'center';
        ctx.fillText(qrConfig.bankName || '', width/2, currentY);
        
        currentY += 40;
        ctx.font = '600 28px "Be Vietnam Pro"';
        ctx.fillStyle = '#64748b';
        ctx.fillText(qrConfig.accountName || '', width/2, currentY);
        
        currentY += 40;
        ctx.fillText(qrConfig.accountNumber || '', width/2, currentY);
        
      } catch (e) {
        console.error('Failed to load QR image for export', e);
      }
    }
    
    // Footer
    currentY = height - 50;
    ctx.font = '600 24px "Be Vietnam Pro"';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('Tạo bởi Cầu Lông Fluid Pro', width/2, currentY);
    
    return canvas;
  };

  return {
    generateReceipt: async (sessionData) => {
      const canvas = await createReceiptCanvas(sessionData, null);
      return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    },
    
    generateReceiptWithQR: async (sessionData, qrConfig) => {
      const canvas = await createReceiptCanvas(sessionData, qrConfig);
      return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    },
    
    generateMonthlyReport: async (sessions, month, year) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const width = 1080;
      
      let totalCost = 0;
      let totalCollected = 0;
      let totalDebt = 0;
      
      sessions.forEach(s => {
        totalCost += s.totalCost || 0;
        totalCollected += s.totalCollected || 0;
        
        const debt = (s.totalCost || 0) - (s.totalCollected || 0);
        if(debt > 0) totalDebt += debt;
      });
      
      const height = 800 + (sessions.length * 70);
      canvas.width = width;
      canvas.height = height;
      
      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      // Top Gradient
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#3b82f6');
      gradient.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, 120);
      
      // Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px "Be Vietnam Pro"';
      ctx.textAlign = 'center';
      ctx.fillText(`BÁO CÁO THÁNG ${month}/${year}`, width / 2, 80);
      
      // Summary Stats
      let currentY = 180;
      drawRoundedRect(ctx, 60, currentY, 460, 150, 20, '#f8fafc', '#e2e8f0');
      drawRoundedRect(ctx, 560, currentY, 460, 150, 20, '#f8fafc', '#e2e8f0');
      
      ctx.font = '600 24px "Be Vietnam Pro"';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.fillText('TỔNG CHI PHÍ', 100, currentY + 50);
      ctx.fillText('TỔNG ĐÃ THU', 600, currentY + 50);
      
      ctx.font = 'bold 44px "Be Vietnam Pro"';
      ctx.fillStyle = '#1e293b';
      ctx.fillText(formatMoney(totalCost), 100, currentY + 110);
      ctx.fillStyle = '#10b981';
      ctx.fillText(formatMoney(totalCollected), 600, currentY + 110);
      
      currentY += 180;
      drawRoundedRect(ctx, 60, currentY, 460, 150, 20, '#f8fafc', '#e2e8f0');
      drawRoundedRect(ctx, 560, currentY, 460, 150, 20, '#fff1f2', '#fecdd3');
      
      ctx.font = '600 24px "Be Vietnam Pro"';
      ctx.fillStyle = '#64748b';
      ctx.fillText('SỐ BUỔI', 100, currentY + 50);
      ctx.fillStyle = '#e11d48';
      ctx.fillText('TỔNG NỢ', 600, currentY + 50);
      
      ctx.font = 'bold 44px "Be Vietnam Pro"';
      ctx.fillStyle = '#1e293b';
      ctx.fillText(`${sessions.length} buổi`, 100, currentY + 110);
      ctx.fillStyle = '#e11d48';
      ctx.fillText(formatMoney(totalDebt), 600, currentY + 110);
      
      currentY += 220;
      ctx.font = 'bold 36px "Be Vietnam Pro"';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('CHI TIẾT CÁC BUỔI', 60, currentY);
      
      currentY += 40;
      sessions.forEach(s => {
        currentY += 70;
        ctx.font = '600 28px "Be Vietnam Pro"';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'left';
        ctx.fillText(s.dateDisplay, 60, currentY);
        
        ctx.textAlign = 'right';
        ctx.font = 'bold 28px "Be Vietnam Pro"';
        ctx.fillStyle = '#1e293b';
        ctx.fillText(formatMoney(s.totalCost || 0), width - 60, currentY);
        
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 2;
        drawDashedLine(ctx, 60, currentY + 25, width - 60, currentY + 25, [10, 10]);
      });
      
      // Footer
      currentY = height - 50;
      ctx.font = '600 24px "Be Vietnam Pro"';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('Tạo bởi Cầu Lông Fluid Pro', width/2, currentY);
      
      return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    },
    
    printReceipt: (sessionData) => {
      const playersHtml = sessionData.players ? sessionData.players.map(p => `
        <div class="row ${p.paid ? 'paid' : 'unpaid'}">
          <span>${p.paid ? '✅' : '❌'} ${p.name}</span>
          <span>${formatMoney(p.amount)}</span>
        </div>
      `).join('') : '';
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Biên lai - ${sessionData.dateDisplay}</title>
          <style>
            body { font-family: 'Be Vietnam Pro', sans-serif; color: #1e293b; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; color: #6366f1; margin-bottom: 10px; }
            .date { font-size: 18px; color: #64748b; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 16px; }
            .row.total { font-weight: bold; font-size: 20px; color: #6366f1; margin-top: 15px; border-top: 2px dashed #e2e8f0; padding-top: 15px; }
            .paid { color: #16a34a; }
            .unpaid { color: #e11d48; }
            @media print {
              body { padding: 0; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">BIÊN LAI CHI PHÍ CẦU LÔNG</div>
            <div class="date">${sessionData.dateDisplay} - ${sessionData.mode === 'home' ? 'Sân Nhà' : 'Giao Lưu'}</div>
          </div>
          
          <div class="section">
            <div class="section-title">CHI PHÍ</div>
            <div class="row"><span>Tiền sân:</span> <span>${formatMoney(sessionData.tienSan || 0)}</span></div>
            <div class="row"><span>Tiền cầu:</span> <span>${formatMoney(sessionData.tienCau || 0)}</span></div>
            <div class="row total"><span>TỔNG CỘNG:</span> <span>${formatMoney(sessionData.totalCost || 0)}</span></div>
          </div>
          
          ${sessionData.players && sessionData.players.length > 0 ? `
            <div class="section">
              <div class="section-title">THÀNH VIÊN (${sessionData.players.filter(p => p.paid).length}/${sessionData.players.length} đã đóng)</div>
              ${playersHtml}
            </div>
          ` : ''}
          
          <div style="text-align: center; margin-top: 40px; color: #94a3b8; font-size: 14px;">
            Cầu Lông Fluid Pro
          </div>
        </body>
        </html>
      `;
      createPrintIframe(html);
    },
    
    printMonthlyReport: (sessions, month, year) => {
      let totalCost = 0;
      let totalCollected = 0;
      let totalDebt = 0;
      
      sessions.forEach(s => {
        totalCost += s.totalCost || 0;
        totalCollected += s.totalCollected || 0;
        const debt = (s.totalCost || 0) - (s.totalCollected || 0);
        if(debt > 0) totalDebt += debt;
      });

      const sessionsHtml = sessions.map(s => `
        <div class="row">
          <span>${s.dateDisplay}</span>
          <span>${formatMoney(s.totalCost || 0)}</span>
        </div>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Báo Cáo - Tháng ${month}/${year}</title>
          <style>
            body { font-family: 'Be Vietnam Pro', sans-serif; color: #1e293b; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; color: #3b82f6; margin-bottom: 10px; }
            .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .stat-box { padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; }
            .stat-label { font-size: 14px; color: #64748b; margin-bottom: 5px; }
            .stat-val { font-size: 20px; font-weight: bold; }
            .text-green { color: #10b981; }
            .text-red { color: #e11d48; }
            .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
            .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; }
            @media print {
              body { padding: 0; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">BÁO CÁO THÁNG ${month}/${year}</div>
            <div>Tổng số buổi: ${sessions.length}</div>
          </div>
          
          <div class="stats">
            <div class="stat-box">
              <div class="stat-label">TỔNG CHI PHÍ</div>
              <div class="stat-val">${formatMoney(totalCost)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">TỔNG ĐÃ THU</div>
              <div class="stat-val text-green">${formatMoney(totalCollected)}</div>
            </div>
            <div class="stat-box" style="grid-column: span 2; border-color: #fecdd3; background: #fff1f2;">
              <div class="stat-label" style="color: #e11d48;">TỔNG NỢ</div>
              <div class="stat-val text-red">${formatMoney(totalDebt)}</div>
            </div>
          </div>
          
          <div>
            <div class="section-title">CHI TIẾT CÁC BUỔI</div>
            ${sessionsHtml}
          </div>
          
          <div style="text-align: center; margin-top: 40px; color: #94a3b8; font-size: 14px;">
            Cầu Lông Fluid Pro
          </div>
        </body>
        </html>
      `;
      createPrintIframe(html);
    }
  };
})();
