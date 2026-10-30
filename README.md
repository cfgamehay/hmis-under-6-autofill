# Khám sức khỏe trẻ dưới 6 tuổi

## Bản 3.21.4

- Bắt response API `kbhkhambenh/dangkykham` ngay sau Lưu để lấy `data.maBenhNhan`, sau đó gọi danh sách khám và lấy `data.content[i].id` làm ID mở phiếu KSK. API `xacnhandenkham` được giữ làm dự phòng.
- Hỗ trợ request xác nhận dạng `Request`, `Blob`, `ArrayBuffer` và URL có chữ hoa/dấu `/` cuối.

## 3.12.8

- Khi địa chỉ khóa được áp dụng sau blur, luồng chọn Tỉnh/Xã không còn cưỡng chế focus quay lại ô Tỉnh/Xã.
- Sau khi chuyển tới Địa chỉ chi tiết, nhấn `Enter` luôn chuyển sang ô tiếp theo kể cả khi người dùng chưa nhập gì.

## 3.12.7

- Quy tắc địa chỉ hỗ trợ mở rộng từ viết tắt bằng `=`, `>` hoặc `->`, ví dụ `kp > khu phố`.
- Sửa vị trí con trỏ sau khi thay thế chuỗi dài hơn: nhập `kp` tạo `khu phố|` thay vì `kh|u phố`.
- Đổi nhãn cấu hình để thể hiện rõ mục này dùng được cho cả viết hoa và mở rộng từ viết tắt.

## 3.12.6

- Thêm nút **Xóa** trên từng địa chỉ thường dùng.
- Xóa một địa chỉ chỉ loại nó khỏi danh sách gợi ý; không xóa giá trị đang có trên form.
- Nếu xóa đúng địa chỉ đang khóa, khóa mặc định cũng được gỡ để địa chỉ đó không tự xuất hiện lại ở form mới.

## 3.12.5

- Khi ô Tỉnh/Xã bị blur, danh sách gợi ý được ẩn ngay và các kết quả tìm kiếm đang chờ bị vô hiệu hóa để không tự hiện lại.
- Việc áp dụng địa chỉ đã khóa lên YTCS vẫn chạy sau blur như trước.

## 3.12.4

- Không còn tự chọn địa chỉ khóa trên YTCS ngay khi trang tải.
- Lần đầu focus ô Tỉnh/Xã có dữ liệu tự ghim, toàn bộ nội dung được chọn để người dùng gõ thay thế hoặc chọn nơi thường dùng khác.
- Chỉ khi ô Tỉnh/Xã bị blur và giá trị tự ghim chưa bị thay đổi, extension mới chọn địa chỉ đó trên form YTCS.

## 3.12.3

- Khi trang Tiếp nhận tải và ô Tỉnh/Xã của YTCS còn trống, extension tự chọn địa chỉ đã khóa trực tiếp trên form YTCS.
- Giá trị được nạp từ địa chỉ khóa có trạng thái riêng: bấm vào ô sẽ chọn toàn bộ nội dung và mở danh sách thường dùng, cho phép chọn nơi khác hoặc gõ thay thế ngay.
- Không ghi đè địa chỉ nếu form YTCS đã có sẵn một địa chỉ khác.

## 3.12.2

- Giảm độ đậm của tên địa chỉ thường dùng xuống mức vừa phải.
- Mỗi địa chỉ thường dùng có nút **Khóa**; chỉ một địa chỉ được khóa tại một thời điểm và địa chỉ đó luôn đứng đầu danh sách.
- Sau **Làm mới & nhập thông tin**, địa chỉ đã khóa được nạp sẵn vào Tỉnh/Xã của form mới; dữ liệu đầy đủ vẫn được giữ để YTCS chọn đúng qua API.

## 3.12.1

- Danh sách thường dùng chỉ hiện **Phường/Xã/Thị trấn — Tỉnh/Thành phố** bằng chữ đậm; không hiện mã địa phương, quận/huyện hay số lượt sử dụng.
- Thêm cấu hình số địa điểm thường dùng tối đa, từ 1 đến 10.
- Đổi phím đảo nhanh Giới tính, Cha/Mẹ, Sinh non và Tiền sử từ `Enter` sang `Space`; `Enter` tiếp tục chuyển sang ô kế tiếp.

## 3.12.0

- Tỉnh/Xã ghi nhận các lựa chọn đã được API YTCS xác nhận, xếp nơi thường dùng theo số lần chọn và hiện ngay khi chạm vào ô; dùng phím `1`–`9`, `0` để chọn nhanh. Khi gõ địa điểm mới, luồng tìm API cũ vẫn giữ nguyên.
- Nhấn Enter tại Giới tính đổi nhanh Nam/Nữ; tại quan hệ Cha/Mẹ đổi nhanh sang lựa chọn còn lại; các switch Sinh non và Tiền sử cũng đổi trạng thái bằng Enter.
- Khi đang ở Giới tính hoặc Sinh non, gõ chữ sẽ chuyển thẳng sang ô Tỉnh/Xã và bắt đầu tìm địa điểm.
- Chu vi vòng cánh tay nhỏ hơn 30 được hiểu là đơn vị cm và tự đổi sang mm, ví dụ `12.5` thành `125`.

## 3.11.1

- Thu phần tùy chọn cấu hình vào vùng cuộn riêng để giao diện không vượt chiều cao màn hình; nút **Ẩn tùy chọn cấu hình** và các nút thao tác luôn bấm được.
- Xác nhận thứ tự định dạng địa chỉ: viết hoa đầu từng từ chạy trước, quy tắc viết hoa riêng chạy sau; vì vậy `cc=CC` luôn giữ kết quả cuối là `CC`.

## 3.11.0

- Hỗ trợ trường mới **Lý do vào viện** (`lyDoVaoVien`) với nội dung cấu hình được và tự động điền.
- Thêm danh sách quy tắc viết hoa riêng cho địa chỉ, ví dụ `cc=CC`; có thể khai báo nhiều dòng.
- Ngày kết thúc kiểm tra hồ sơ trùng luôn dùng ngày hiện tại; ngày bắt đầu tiếp tục được lưu theo lần người dùng sửa.
- Khi đang ở nhóm Tiền sử, gõ một chữ số sẽ chuyển thẳng sang ô Nhiệt độ và nhập số đó.
- Thêm tùy chọn tự chuyển ô khi CCCD, ngày sinh hoặc số điện thoại đã đủ số ký tự cố định.
- Danh sách gợi ý Tỉnh/Xã có nút số và hỗ trợ nhấn phím `1`–`9`, `0` để chọn nhanh.

Extension nổi để điền nhanh form Angular tiếp nhận và khám sức khỏe trẻ dưới 6 tuổi. Extension không thay đổi bản Multiple Find Bulk.

Giao diện extension nổi phía trên trang VNPT HIS và không thay đổi chiều rộng, margin hoặc bố cục của website. Nút `>` giấu toàn bộ giao diện sang mép phải, `<` mở lại; nhấn biểu tượng extension trên thanh công cụ cũng bật/tắt giao diện nổi.

Nhập dữ liệu trong giao diện nổi chỉ lưu nháp, không đẩy từng ký tự sang website. Khi bấm **Điền toàn bộ**, website lần lượt cuộn mượt và focus từng trường ngay trước khi điền, tô viền cam để người dùng theo dõi. Quy trình vẫn áp dụng giá trị mặc định và báo các trường chưa điền được.

Cụm **Điền toàn bộ · Xóa dữ liệu** và dòng trạng thái nằm nổi ở đáy trên lớp nền bán trong suốt được làm mờ, giúp nút dễ nhận diện mà không che cứng nội dung phía sau. Lựa chọn **Ghi đè** dùng giao diện switch Có/Không.

Nút `>` ở mép phải thu toàn bộ giao diện extension sang bên; khi ẩn chỉ còn tab `<` để mở lại. Trạng thái ẩn/hiện toàn extension được ghi nhớ.

Sau lần nâng cấp đầu tiên lên v2.4.0, mọi checkbox/switch được đặt về **tắt**, riêng **Ghi đè dữ liệu** được bật. Các thay đổi tiếp theo của người dùng vẫn được lưu bình thường.

Chức năng tự tìm bé theo tên đã được bỏ. Tại trang **Danh sách khám bệnh**, cửa sổ nổi tự thu thành một khung nhỏ chỉ còn **Họ và tên** cùng **Ngày sinh**, tránh che các nút thao tác của bảng. Khi chuyển sang trang tiếp nhận hoặc trang nhập khám sức khỏe, toàn bộ trường tự hiện lại.

Tại **Danh sách khám bệnh**, nút **Khám lâm sàng** được hiển thị thành nút lớn **Khám sức khỏe trẻ dưới 6 tuổi**. Thao tác thủ công vẫn chuyển đúng sang phiếu KSK; khi bật luồng tự tìm sau lưu, extension có thể bắt đầu khám và mở KSK tự động.

## Bản 3.10.0

- Sau cú bấm **Ký** thật của người dùng trên phiếu KSK, extension tự mở luồng ký, xác nhận lần lượt **Người kết luận** và **Con dấu**, rồi bấm **Hoàn tất ký số**.
- Nếu cấp Con dấu còn bị khóa, extension chờ cấp Người kết luận hoàn thành và tự mở lại cửa sổ ký để xử lý cấp tiếp theo.
- Luồng có khóa chờ phản hồi để không bấm hoàn tất lặp; sau khi ký đủ hai cấp, trang được giữ nguyên tại kết quả cuối và extension hiện lại.

## Bản 3.9.0

- Luồng sau lưu gọi đúng API của màn Danh sách khám bệnh: `POST /api/common/kbhphongkhamdangky/batdaukham` trước khi mở phiếu KSK.
- Payload bắt đầu khám được dựng từ đúng bản ghi có Mã bệnh nhân trùng khớp; trạng thái **Chưa khám** được chuyển sang **Đang khám** rồi mới điều hướng.
- Nếu hồ sơ đã ở trạng thái **Đang khám**, extension bỏ qua lần gọi cập nhật; nếu API trả cảnh báo/lỗi hoặc hồ sơ ở trạng thái khác, luồng dừng và hiện lý do thay vì mở phiếu sai trạng thái.
- Khóa request theo `phongKhamDangKyId` để tránh gọi API bắt đầu khám lặp trong lúc trang đang cập nhật.

## Bản 3.8.5

- Cảnh báo sớm màu vàng tại ô Ngày sinh khi trẻ đã đủ 6 tuổi và không còn thuộc nhóm dưới 6 tuổi.
- Cảnh báo tuổi không chặn Autofill, chỉ hỗ trợ người dùng rà soát lại.

## Bản 3.8.4

- Nút Làm mới chỉ xóa dữ liệu biểu mẫu, không đặt lại các tùy chọn cấu hình.
- Giữ nguyên switch, khoảng ngày kiểm tra, tốc độ Autofill, tự chuyển ô và lựa chọn hiển thị hướng dẫn.

## Bản 3.8.3

- Tùy chọn địa chỉ giờ viết hoa chữ cái đầu của từng từ, đồng thời giữ nguyên các chữ viết hoa có sẵn.

## Bản 3.8.2

- Nút Làm mới không còn tự bật lại phần hướng dẫn; lựa chọn ẩn/hiện hướng dẫn được giữ nguyên.

## Bản 3.8.1

- Chỉ hiện kiểm tra sớm cho những ô người dùng đã focus hoặc chỉnh sửa; ô chưa đụng tới không bị đánh dấu.
- Khi bấm Điền toàn bộ, tất cả trường còn thiếu hoặc sai sẽ tự hiển thị cảnh báo.

## Bản 3.8.0

- Kiểm tra sớm các trường bắt buộc và các giá trị sai định dạng, hiển thị lý do ngay dưới ô tương ứng.
- Ô đang được focus/gõ sẽ tạm bỏ qua kiểm tra; lỗi chỉ xuất hiện sau khi người dùng rời ô hoặc chuyển sang trường khác.

## Bản 3.7.5

- Không còn tự chèn dấu hoặc đổi ngày trong lúc người dùng đang gõ, nên có thể xóa/sửa tự do.
- Chỉ chuẩn hóa ngày khi nhấn Enter: `1/1/20` thành `01/01/2020`, `1/1/2024` thành `01/01/2024`.

## Bản 3.7.4

- Ngày sinh và khoảng ngày kiểm tra chấp nhận ngày rút gọn như `1/1/24`.
- Dạng rút gọn tự chuẩn hóa thành `01/01/2024`; năm 2 chữ số được hiểu là năm `20xx`.

## Bản 3.7.3

- Hai ô Từ ngày/Đến ngày trong cấu hình và popup hồ sơ trùng dùng định dạng `dd/mm/yyyy`.
- Chấp nhận nhập liền `ddmmyyyy` rồi tự chèn dấu `/`; dữ liệu gửi API vẫn được chuyển đúng sang chuẩn nội bộ.

## Bản 3.7.2

- Ô Ngày sinh chấp nhận cả `ddmmyyyy` và `dd/mm/yyyy`.
- Khi nhập đủ 8 chữ số, giao diện tự định dạng thành `dd/mm/yyyy`; Autofill và API vẫn nhận đúng dữ liệu 8 số.

## Bản 3.7.1

- Thêm switch **Hiện hướng dẫn** để ẩn hoặc hiện toàn bộ các dòng mô tả trong panel.
- Trạng thái ẩn/hiện hướng dẫn được lưu cùng cấu hình extension.

## Bản 3.7.0

- Đưa nút **Quay về form nhập** xuống đáy panel tại trang Danh sách khám bệnh.
- Chuẩn hóa font chữ: nội dung ô nhập dùng cùng một độ đậm, nhãn và nút dùng độ đậm thống nhất.
- Họ tên người khám tự viết hoa toàn bộ; tên người giám hộ tự viết hoa đầu mỗi từ.
- Thêm tùy chọn viết hoa chữ cái đầu của địa chỉ chi tiết.
- Tự bật kiểm tra bệnh nhân sau khi nâng cấp; khoảng ngày kiểm tra hiển thị và chỉnh trực tiếp trong popup hồ sơ trùng.
- Cho phép thời gian Autofill từ `0,1` đến `5` giây mỗi ô.

## Bản 3.6.0

- Đổi biểu tượng trạng thái thành các nhãn chữ: **Trùng hồ sơ**, **Không trùng**, **Lỗi**, **Đang kiểm tra** và **Chưa kiểm tra**.
- Nút trạng thái và bảng chi tiết nằm ngoài panel extension, kéo được khắp trang HMIS và ghi nhớ vị trí.
- Bảng chi tiết dùng nút chữ **Mở rộng/Ẩn**.
- Tại trang Danh sách khám bệnh có nút **Quay về form nhập**.

## Bản 3.5.0

- Chỉnh lại biểu tượng cảnh báo và bảng thông tin trùng thành một widget gọn, thẳng hàng.
- Có thể kéo biểu tượng hoặc đầu bảng thông tin đến vị trí bất kỳ; vị trí được lưu cho lần mở sau.
- Bảng chỉ hiện tiêu đề **Phát hiện trùng** và dùng đường kẻ mảnh phân cách từng thông tin.

## Bản 3.4.0

- Không tự bật hộp kết quả kiểm tra bệnh nhân.
- Hiển thị một biểu tượng trạng thái nhỏ: xám khi chưa đủ dữ liệu, xanh khi đang/đã kiểm tra không trùng, vàng khi có hồ sơ trùng.
- Chỉ mở thông tin bệnh nhân khi người dùng bấm biểu tượng vàng; bấm lại để đóng.

## Bản 3.3.0

- Thông báo kiểm tra bệnh nhân dùng biểu tượng dấu kiểm/cảnh báo và có thể bấm mở chi tiết.
- Nhiều kết quả được hiển thị thành danh sách xổ xuống riêng cho từng bệnh nhân.
- Lấy CCCD và thông tin bổ sung bằng `tiepNhanId` từ API thông tin bệnh nhân.
- Khi mở chi tiết, thông báo không tự ẩn giữa lúc người dùng đang xem.

## Bản 3.2.0

- Khi đủ Tên, Ngày sinh và Giới tính, tự kiểm tra sau 0,5 giây nếu tùy chọn kiểm tra đang bật.
- Hiển thị thông báo nổi kết quả và tự ẩn sau 7 giây.
- Kiểm tra sớm chỉ hoạt động trên form Tiếp nhận; bước xác nhận khi điền vẫn được giữ nguyên.

## Bản 3.1.2

- Sửa lỗi gateway trả HTTP 200 nhưng JavaScript không đọc được response do kết hợp `credentials: include` với CORS wildcard.
- Dùng Bearer token do HMIS cung cấp và bỏ cookie khỏi request cross-origin.

## Bản 3.1.1

- Sao chép đầy đủ các header ngữ cảnh an toàn từ request HMIS khi kiểm tra bệnh nhân.
- Thêm retry, giới hạn thời gian từng request và thông báo chi tiết khi API không trả response.

## Bản 3.1.0

- Thêm tùy chọn kiểm tra bệnh nhân đã được tiếp nhận trong khoảng ngày do người dùng chọn.
- Gọi API danh sách khám bệnh từ ngữ cảnh trang HMIS để sử dụng thông tin xác thực hiện có.
- Đối chiếu họ tên, ngày sinh và giới tính; cảnh báo và yêu cầu xác nhận trước khi điền form Tiếp nhận.
- Kiểm tra này không áp dụng cho phiếu khám sức khỏe (form thứ hai).

## Bản 3.0.1

- Gợi ý Tỉnh/Xã chỉ lấy từ phản hồi API hiện tại; bỏ hoàn toàn lịch sử địa điểm khỏi danh sách và chỉ lưu lựa chọn sau khi form HIS xác nhận thành công.
- Dân tộc mặc định là **Kinh**. Khi gõ sẽ mở danh sách nổi giống Tỉnh/Xã, nhưng không lưu lịch sử những dân tộc từng nhập.
- Đổi Sinh non và ba mục Tiền sử từ radio sang switch Có/Không.
- Làm phẳng các nhóm bằng đường phân cách nhẹ, bỏ bớt khung và nền lồng nhau.

## Bản 3.0.0

- Thêm thanh tăng/giảm cỡ chữ từ `12–22px`; lựa chọn được ghi nhớ.
- Thêm tay nắm ở góc trái dưới để resize chiều rộng/chiều cao panel và lưu kích thước; có nút khôi phục kích thước mặc định trong cấu hình.
- Sắp xếp lại phần nhập: Họ tên → Căn cước → Ngày sinh → Giới tính → Sinh non → Dân tộc → Tỉnh/Xã → Địa chỉ chi tiết → Người giám hộ → Mối quan hệ → Số điện thoại → CCCD người đi cùng → Tiền sử.
- Thêm **Sinh non** dạng Có/Không và danh sách 54 dân tộc có thể gõ để lọc/chọn.
- Thêm tiền sử **Bản thân**, **Gia đình**, **Tiếp xúc người bệnh lao**. Hai mục đầu tự hiện ô ghi chú/Tên bệnh khi chọn Có và được điền đúng vào hai ô riêng trên form KSK.

## Bản 2.9.6

- Tỉnh/Xã được đồng bộ ngầm sang ô tìm kiếm của HIS trong lúc người dùng gõ; extension không gọi `focus()` vào input của website.
- Sau thao tác mở danh sách, phát sự kiện tìm kiếm hoặc chọn địa điểm, extension chủ động trả focus về ô Tỉnh/Xã trong panel bằng thông điệp tới iframe.
- Mỗi thay đổi được gửi ngầm sang input tìm kiếm của HIS; việc đọc danh sách kết quả được debounce riêng nên không làm gián đoạn thao tác gõ.

## Bản 2.9.4

- Ô **Tỉnh/Xã** giữ con trỏ trong giao diện extension khi lấy gợi ý; dùng phím `↑`/`↓` để duyệt và `Space` hoặc `Enter` để chọn mục đang tô sáng.
- Từ khóa đang gõ và địa điểm đã chọn được lưu cục bộ ngay, không phải chờ API của form phản hồi. API chỉ tiếp tục đồng bộ lựa chọn sang form website ở nền.
- Không tự chuyển sang ô kế tiếp sau khi chọn Tỉnh/Xã.
- Sau khi điền thành công, panel giữ trạng thái ẩn và tự hiện lại khi chuyển sang URL khác. Nếu điền lỗi, panel được mở lại để người dùng sửa dữ liệu.

## Bản 2.9.3

- Trên phiếu KSK, extension tiếp tục ẩn sau khi điền và sau khi bấm **Lưu**; không còn tự hiện lại giữa quy trình ký.
- Extension chỉ tự hiện và mở rộng sau khi phát hiện thông báo **Hoàn thành ký số**, thông báo ký thành công, hoặc cửa sổ ký đóng sau khi người dùng bấm **Hoàn tất ký số**.

## Bản 2.9.2

- Sau API xác nhận đến khám trả về `MA_BN`, extension gọi trực tiếp API `danhsachkhambenh` của ngày hiện tại với `phongId=201` và mã bệnh nhân đó.
- Extension chỉ nhận bản ghi có `benhNhan.maBenhNhan` trùng chính xác, lấy `id` ở cấp bản ghi trong `data.content` rồi mở thẳng phiếu KSK; không lấy nhầm `benhNhan.id` hay `khamBenh.id`.
- Tìm kiếm trên giao diện Danh sách khám bệnh chỉ còn là phương án dự phòng khi API trực tiếp không trả về đúng một bản ghi.

## Bản 2.9.1

- Nút **Làm mới & nhập thông tin** không tải lại trang nếu người dùng đã đứng tại `/tnkb/tiepnhan`; chỉ xóa dữ liệu extension và mở lại giao diện.
- Chỉ điều hướng về trang Tiếp nhận khi đang ở một trang khác.

## Bản 2.9.0

- Bắt phản hồi API tìm bệnh nhân, lấy trực tiếp `id` của bản ghi có `MA_BN` tương ứng và mở `/ksk-tre-duoi-6-tuoi?id=...`; nút hành động trong bảng chỉ còn là phương án dự phòng.
- Đổi **Xóa dữ liệu** thành **Làm mới & nhập thông tin**: xóa dữ liệu extension, mở lại giao diện và quay về `/new/his/ngoaitru/tnkb/tiepnhan` với form website mới.
- Sau khi **Điền toàn bộ** hoàn tất, giao diện extension tự hiện lại, không tiếp tục ẩn trong lúc người dùng lưu bước 2.

## Bản 2.8.8

- Luồng sau lưu chỉ đối chiếu `MA_BN`; không còn yêu cầu họ tên trùng hoặc tương đương.
- Khi kết quả có đúng một dòng và Mã bệnh nhân trùng chính xác, extension mở KSK ngay.

## Bản 2.8.7

- Loại dòng kỹ thuật `ui-table-measure-now` khỏi phép đếm, nên giao diện có một bệnh nhân được nhận diện đúng là một kết quả.
- Nhận diện nút mở khám mới qua icon `signature`/`ph-signature`, kích hoạt nút để Angular tạo URL có `id`, rồi đổi sang trang KSK.

## Bản 2.8.6

- Đối chiếu họ tên không còn yêu cầu chuỗi giống tuyệt đối: bỏ qua hoa/thường, dấu tiếng Việt, dấu câu và khoảng trắng; đồng thời chấp nhận tên chứa nhau hoặc khớp phần lớn các từ.
- Mã bệnh nhân vẫn phải trùng chính xác và kết quả tìm kiếm vẫn phải chỉ có đúng một dòng.

## Bản 2.8.5

- Sửa luồng tìm sau lưu: nhập `MA_BN` vào đúng ô **Tìm theo mã BA/BN** phía trên thay vì ô lọc trong tiêu đề bảng.
- Extension bấm trực tiếp nút **Tìm kiếm (F3)** (`#timKiem`); chỉ phát phím F3 khi không tìm thấy nút.

## Bản 2.8.4

- **Autofill: hiển thị mỗi ô** mặc định là `0,25 giây`; mỗi bước cuộn và focus ô hiện tại, chờ theo cấu hình, điền rồi mới chuyển sang ô kế tiếp.
- **Sau lưu: tìm Mã BN và mở KSK** được bật sẵn cho cả cài đặt mới và lần nâng cấp đầu tiên lên bản này.

## Bản 2.8.3

- Sau khi điền `MA_BN` vào bộ lọc Mã bệnh nhân, extension phát đủ thao tác nhấn **Enter** trong khi ô vẫn giữ focus.
- Chỉ mở KSK khi bảng trả về đúng một dòng và dòng đó khớp đồng thời Mã bệnh nhân cùng họ tên; nút của dòng kết quả cung cấp `id` để chuyển thẳng sang KSK.

## Bản 2.8.2

- Khối tùy chọn cấu hình có thể ẩn/hiện và ghi nhớ trạng thái.
- Nhấn **Enter** trong form nhập dữ liệu sẽ chuyển ngay sang ô kế tiếp; ở ô cuối sẽ focus nút **Điền toàn bộ**.
- Luồng sau lưu tiếp tục chờ API xác nhận đến khám, lấy `MA_BN`, lọc cột Mã bệnh nhân và mở KSK khi tùy chọn tương ứng được bật; extension không tự bật lại mục **In phiếu** của website.

## Bản 2.8.1

- Tách rõ **Autofill: hiển thị mỗi ô** với **Nhập dữ liệu: tự chuyển ô**. Khi bật tự chuyển ô, extension chờ theo số giây đã chọn sau khi người dùng ngừng nhập rồi focus ô kế tiếp trong giao diện extension.
- Tất cả lựa chọn của Khám mũi, Khám miệng–răng và Phản xạ đều nằm riêng từng dòng.
- Có thể bấm toàn bộ hàng lựa chọn; hàng đang bật có nền xanh mờ và vạch trạng thái để dễ nhận biết.

## Bản 2.8.0

- Thêm lựa chọn **Sau lưu: tìm Mã BN và mở KSK**. Khi bật, extension lấy `MA_BN` từ API xác nhận đến khám, lọc cột **Mã bệnh nhân**, đối chiếu đúng họ tên và mở KSK của dòng đầu tiên phù hợp.
- Thêm thời gian **Dừng ở mỗi ô** từ 0,1–5 giây để điều chỉnh tốc độ focus/chuyển qua trường kế tiếp khi điền toàn bộ.
- Đổi thứ tự hai lựa chọn khám răng; mỗi lựa chọn nằm trên một dòng và có thể bấm trên toàn hàng.

## Bản 2.7.2

- Chặn vòng lặp DOM từng làm danh sách khám bệnh cập nhật liên tục.
- Phần nút KSK không đọc, nhập hoặc kích hoạt ô tìm kiếm; thay đổi của bảng được gom xử lý tối đa một lần mỗi khung hình.

## Bản 2.7.1

- Khôi phục nút thủ công **Khám sức khỏe trẻ dưới 6 tuổi** tại từng dòng của danh sách khám bệnh.
- Nút chỉ đổi đường dẫn khi người dùng trực tiếp bấm; Auto không kích hoạt chuyển trang.

## Bản 2.7.0

- Bỏ chức năng tự mở thẳng Khám sức khỏe.
- Khi bấm **Điền toàn bộ**, giao diện extension tự ẩn sang cạnh màn hình trong suốt quá trình và giữ trạng thái ẩn; khi URL chuyển sang trang khác, giao diện tự hiện lại.
- Phiếu khám được chia thành các nhóm: **Dấu hiệu sinh tồn** (nhiệt độ, mạch, nhịp thở), **Chỉ số phát triển** (chiều dài, cân nặng, vòng đầu, vòng cánh tay), **Khám mũi**, **Khám miệng, răng** và **Phản xạ**.

## Cài đặt

1. Mở `brave://extensions`.
2. Bật **Chế độ dành cho nhà phát triển**.
3. Chọn **Tải tiện ích đã giải nén**.
4. Chọn thư mục `D:\hospital-reception-autofill-unpacked`.
5. Tải lại trang tiếp nhận bệnh nhân.

## Trường được hỗ trợ

- Họ và tên → `hoTen`
- CCCD trẻ em → `cccd`
- Ngày sinh → `ngaySinh`
- Giới tính → `gioiTinh`
- SĐT người liên hệ → `sdtNLH`
- Tên người liên hệ/giám hộ → `nguoiLH`
- MQH với bệnh nhân → `moiQuanHe`. Do form đích dùng chung mục **Bố/Mẹ**, cả Cha và Mẹ đều được ánh xạ vào mục này; Họ hàng được ánh xạ sang **Khác**
- Tỉnh/Xã → tìm và chọn duy nhất trên `oh-select[formcontrolname="tinhHuyenXa"]`
- Số nhà/địa chỉ chi tiết → `soNha`
- Nếu `diaChi` của bệnh nhân có dữ liệu, tự sao chép sang địa chỉ người liên hệ/phụ huynh `diaChiLH`; sau đó tiếp tục đồng bộ theo thời gian thực mỗi khi `soNha` hoặc `diaChi` thay đổi
- Đối tượng → tự chọn **Miễn phí**
- Lý do tiếp nhận → tự chọn **Khám bệnh**
- Giấy tờ tiếp nhận → tự chọn **Định danh công dân**
- Yêu cầu khám → tự chọn **KSK_TRE_DUOI_6_TUOI - Khám sức khỏe trẻ em dưới 6 tuổi**
- Phòng khám → sau khi chọn Yêu cầu khám và chờ danh sách tải xong, tự chọn option đầu tiên

Khi gõ Tỉnh/Xã trong giao diện nổi, extension nhập từ khóa vào chính ô search của `tinhHuyenXa`. Form VNPT HIS tự gọi API địa phương bằng phiên đăng nhập hiện tại và bộ `fields/filter/page/size/sort` của nó. Kết quả được đưa về giao diện extension thành danh sách gợi ý. Khi chọn một mục (ví dụ `dntb - Phường Trấn Biên - Tỉnh Đồng Nai`), extension click đúng option trên form; các trường địa chỉ bên cạnh do website tự cập nhật và extension không điền lại. Các địa điểm đã chọn được lưu cục bộ để gợi ý nhanh ở lần sau.

Trong form tiếp nhận, extension chọn giới tính trước rồi mới nhập ngày sinh. Nếu logic của website tự đổi lại giới tính sau khi xử lý ngày sinh, extension kiểm tra giá trị hiển thị và chọn lại đúng Nam/Nữ đã cấu hình.

Ngày sinh được nhập dưới dạng 8 chữ số, ví dụ `14022004`, trực tiếp vào thẻ `input[placeholder="dd/mm/yyyy"]` đang hiển thị. Từng chữ số được đưa qua luồng nhập văn bản của trình duyệt để bộ định dạng của website tự thêm dấu phân cách. Extension chỉ báo thành công khi input giữ đúng ngày và Angular date-picker không còn trạng thái `ng-invalid`.

Extension chỉ chấp nhận SĐT đủ 10 chữ số và CCCD đủ 12 chữ số. Dữ liệu sai độ dài sẽ được tô đỏ và không được gửi sang form.

## Form khám sức khỏe trẻ dưới 6 tuổi

Giao diện nổi cho phép lưu trước và điền các trường: CCCD người đi cùng trẻ, nhiệt độ, mạch, nhịp thở, chiều dài, cân nặng, vòng đầu và chu vi vòng cánh tay. Vì form này không có `formcontrolname`, extension định vị input theo nhãn trong cùng `oh-form-item`. Giá trị thập phân của các chỉ số dùng dấu phẩy hoặc dấu chấm đều được chấp nhận; riêng chu vi vòng cánh tay dạng `12,5` hoặc `12.5` được đổi thành `125` mm.

Các ô nhiệt độ, mạch, nhịp thở và vòng đầu để trống thật; giá trị `37`, `92`, `22`, `50` chỉ xuất hiện dưới dạng placeholder. Nếu người dùng không nhập, extension mới dùng các giá trị này khi điền form. Quan hệ mặc định là **Mẹ**. Trên form tiếp nhận, Cha hoặc Mẹ được ánh xạ sang option chung **Bố/Mẹ**; trên form khám dưới 6 tuổi, extension chọn đúng checkbox riêng **Cha** hoặc **Mẹ** (tương tự cho Ông/bà, Anh/chị, Họ hàng và Khác).

Các lựa chọn hay gặp gồm Chảy nước mũi, Nghẹt mũi, Vết sâu/mảng bám/lỗ trên răng, Răng sữa sơ sinh, Phản xạ nắm và Phản xạ Moro. Mỗi mục trong giao diện nổi là một switch có nhãn trạng thái **Có/Không** rõ ràng và mặc định đều tắt. Khi điền, extension chỉ thao tác trên cặp checkbox nằm ngay sau đúng câu hỏi và xác minh cuối cùng có đúng một lựa chọn được bật.

Mặc định extension chỉ điền ô trống. Bật **Ghi đè trường đã có dữ liệu** nếu muốn thay nội dung hiện tại.

