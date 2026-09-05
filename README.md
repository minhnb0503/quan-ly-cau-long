# Cầu Lông Pro

Ứng dụng web nhẹ để chia chi phí sân/cầu, quản lý thành viên, theo dõi thanh toán và tạo VietQR. Toàn bộ dữ liệu được lưu trên chính trình duyệt của người dùng; dự án không cần máy chủ hay cơ sở dữ liệu bên ngoài.

## Tính năng

- Chia tiền cho sân nhà hoặc sân khách với nhiều quy tắc.
- Tính tiền cầu theo tổng tiền hoặc chi tiết giá ống/số quả.
- Quản lý thành viên cố định và khách giao lưu.
- Theo dõi người đã đóng, số tiền còn thiếu và trạng thái buổi chơi.
- Tạo VietQR riêng cho từng khoản cần thu ngay trên thiết bị.
- Xuất biên lai ảnh, in PDF, báo cáo tháng và sao lưu/khôi phục JSON.
- Giao diện responsive, chế độ sáng/tối và điều khiển bằng bàn phím.

## Cải tiến 2.1 — nhập và xem kết quả trên điện thoại

- Mở trực tiếp màn hình tính tiền. Ô nhập có chữ từ 16px trở lên, không có hiệu ứng phóng/co khi focus; vẫn cho phép người dùng phóng to bằng hai ngón tay.
- Bàn phím số, ô tùy chỉnh rộng hơn, giữ con trỏ khi sửa giữa số tiền. Enter ở tiền sân chuyển đến tiền cầu; Enter ở các ô còn lại kết thúc nhập.
- Kết quả ưu tiên số tiền mỗi người đóng, phân biệt giá/người với tổng của nhóm và hiển thị tổng cần thu, dư hoặc thiếu cho mọi cách chia.
- Theo dõi thanh toán được thu gọn; mở lịch sử không thay đổi buổi đang nhập.
- Các tài nguyên dùng phiên bản `2.1.0` để trình duyệt tải bản CSS/JS mới sau khi cập nhật website.

Khi kiểm tra trên iPhone, thử nhập/sửa tiền sân, tiền cầu, số người và mức thu tùy chỉnh; mở/đóng bàn phím rồi tính lại. Kiểm thử trên máy tính với viewport nhỏ không thay thế hoàn toàn Safari và bàn phím iPhone thật.

## Chạy trên máy

Không cần cài thư viện. Tại thư mục dự án, chạy:

```bash
npm start
```

Sau đó mở `http://localhost:4173`.

Bạn cũng có thể mở bằng bất kỳ static server nào. Không nên mở trực tiếp `index.html` bằng giao thức `file://` vì một số trình duyệt giới hạn tính năng tải file, clipboard và lưu dữ liệu.

## Kiểm tra trước khi đẩy GitHub

Yêu cầu Node.js 18 trở lên:

```bash
npm test
npm run check
```

## Đưa lên GitHub Pages

1. Đẩy toàn bộ thư mục lên repository GitHub.
2. Vào **Settings → Pages**.
3. Chọn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`.
4. Lưu và đợi GitHub tạo đường dẫn công khai.

## Dữ liệu và quyền riêng tư

- Buổi chơi, thành viên, trạng thái thanh toán và cấu hình QR được lưu bằng IndexedDB/localStorage.
- Ứng dụng không thu thập IP và không tự động gửi báo cáo tới dịch vụ bên ngoài.
- Hãy dùng mục **Dữ liệu** để tải file sao lưu định kỳ, đặc biệt trước khi xóa dữ liệu trình duyệt hoặc đổi thiết bị.
- Số tài khoản trong mã QR chỉ nằm trên thiết bị và được mã hóa trực tiếp vào nội dung QR.

## Cấu trúc

```text
index.html          Giao diện và cấu trúc ứng dụng
css/style.css       Hệ thống giao diện responsive
js/app.js           Luồng tương tác và hiển thị
js/calculator.js    Các hàm tính toán thuần
js/storage.js       Lưu trữ, sao lưu và khôi phục
js/vietqr.js        Tạo mã VietQR cục bộ
js/pdf-export.js    In biên lai và báo cáo
tests/              Kiểm thử công thức tính tiền
```
