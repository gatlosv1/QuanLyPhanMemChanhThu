const express = require('express');
const router = express.Router();
const { getPool, mssql } = require('../db');
const { validateQRPayload, authenticateRequest, authorizeRole } = require('../security');

// Lưu QR code được tạo vào database
router.post('/qr/save', authenticateRequest, authorizeRole(['admin', 'editor']), validateQRPayload, async (req, res) => {
  try {
    const { ttxe, ncc, noi, hang, mui, vitri1, vitri2, ngay, ma_lo } = req.body;

    if (!ma_lo || !ttxe) {
      return res.status(400).json({ error: 'Thiếu dữ liệu bắt buộc' });
    }

    const pool = await getPool();
    const request = pool.request();

    request.input('ttxe_code', mssql.Char(2), ttxe);
    request.input('nha_cung_cap_code', mssql.Char(3), ncc);
    request.input('noi_san_xuat_code', mssql.Char(2), noi);
    request.input('hang_code', mssql.Char(1), hang);
    request.input('loai_sau_rieng_code', mssql.Char(2), mui);
    request.input('vi_tri_u1', mssql.NVarChar(50), vitri1 || null);
    request.input('vi_tri_u2', mssql.NVarChar(50), vitri2 || null);
    request.input('ngay_nhap', mssql.DateTime2, new Date(ngay));
    request.input('ma_lo', mssql.NVarChar(100), ma_lo);

    await request.query(`
      INSERT INTO [dbo].[lo_san_xuat] (
        [ttxe_code], 
        [nha_cung_cap_code], 
        [noi_san_xuat_code], 
        [hang_code], 
        [loai_sau_rieng_code], 
        [vi_tri_u1], 
        [vi_tri_u2], 
        [ngay_nhap], 
        [ma_lo]
      ) VALUES (
        @ttxe_code, 
        @nha_cung_cap_code, 
        @noi_san_xuat_code, 
        @hang_code, 
        @loai_sau_rieng_code, 
        @vi_tri_u1, 
        @vi_tri_u2, 
        @ngay_nhap, 
        @ma_lo
      )
    `);

    res.json({ success: true, message: 'QR code đã được lưu', ma_lo });
  } catch (err) {
    console.error('Lỗi khi lưu QR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Lấy danh sách QR code đã tạo
router.get('/qr/list', authenticateRequest, authorizeRole(['admin', 'viewer', 'editor']), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        [id], 
        [ttxe_code], 
        [nha_cung_cap_code], 
        [noi_san_xuat_code], 
        [hang_code], 
        [loai_sau_rieng_code], 
        [vi_tri_u1], 
        [vi_tri_u2], 
        [ngay_nhap], 
        [ma_lo],
        [created_at]
      FROM [dbo].[lo_san_xuat] 
      ORDER BY [created_at] DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách QR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
