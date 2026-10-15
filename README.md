# PanelForge · UML State Machines & Simulator

> **Dự án tốt nghiệp SEP490 · FA26SE251 · Hệ thống hỗ trợ sản xuất truyện tranh trực tuyến (PanelForge)**

Ứng dụng web tĩnh trực quan hoá và mô phỏng tương tác toàn bộ vòng đời trạng thái (**10 UML State Machines**) của hệ thống PanelForge. Dữ liệu và các luật chuyển trạng thái được trích xuất và đối chiếu trực tiếp từ tầng Domain và các Handler trong Backend PanelForge, bám sát nghiệp vụ trong **Phiếu đăng ký đề tài V1.2**.

---

## 🚀 Tính năng chính

- **Tổng quan liên kết thực thể (Overview Map):** Sơ đồ quan hệ và luồng kích hoạt giữa 10 thực thể cốt lõi trong hệ thống.
- **Sơ đồ chi tiết 10 State Machines (Diagrams):**
  - Hiển thị tên trạng thái, hoạt động nội tại (`entry / do`), mã enum.
  - Bảng chi tiết: *Từ trạng thái*, *Event*, *Vai trò thực hiện (Who)*, *Điều kiện (Guard)*, *Đến trạng thái*, *Hành động (Action)* và *Handler xử lý*.
  - Tích hợp sẵn 25 kịch bản (Flows) nghiệp vụ thực tế có kết quả kiểm tra từng bước.
- **Bộ mô phỏng tương tác trực tiếp (Interactive Simulator):**
  - Chạy kịch bản từng bước với thuyết minh nghiệp vụ hoặc bật chế độ **"Tự chạy" (Auto-run)**.
  - Tự kích hoạt event bất kỳ theo vai trò.
  - Thay đổi giá trị biến đầu vào để kiểm tra trường hợp bị Guard chặn hoặc cho phép chuyển tiếp.
  - Hạt particle di chuyển trực quan theo đường cong SVG và ghi lại lịch sử nhật ký (Log).
  - Hỗ trợ đầy đủ Dark Mode / Light Mode và Responsive trên thiết bị di động.

---

## 📂 Danh mục 10 State Machine

1. **Chapter** (`Content/Chapter.cs`): Quản lý vòng đời chương truyện từ khi vẽ đến duyệt và phát hành.
2. **Assignment** (`Workflow/Assignment.cs`): Phân công và theo dõi nhiệm vụ của các Artist/Letterer/Writer.
3. **StageProgress** (`Workflow/StageProgress.cs`): Tiến độ chi tiết từng panel theo từng công đoạn vẽ.
4. **Submission** (`Workflow/Submission.cs`): Lịch sử và trạng thái các lần nộp bài của thành viên.
5. **ChangeRequest** (`Workflow/ChangeRequest.cs`): Yêu cầu chỉnh sửa khi bài nộp chưa đạt chuẩn.
6. **ConsistencyFinding** (`Quality/ConsistencyFinding.cs`): Lỗi kiểm tra tính nhất quán (nhân vật, trang phục, bối cảnh).
7. **PreviewFeedback** (`Quality/PreviewFeedback.cs`): Phản hồi từ độc giả/đội ngũ xem thử trước khi xuất bản.
8. **AiWorkflowRun** (`AI/AiWorkflowRun.cs`): Lượt thực thi của các trợ lý AI hỗ trợ Writer.
9. **AiSuggestion** (`AI/AiSuggestion.cs`): Các đề xuất kịch bản từ AI chờ con người phê duyệt.
10. **ExportJob** (`Publishing/ExportJob.cs`): Quá trình đóng gói và xuất file định dạng phát hành.

---

## 🛠️ Cấu trúc thư mục

```text
├── index.html                     # Trang chủ điều hướng trung tâm
├── state-machine-diagrams.html    # Trang tổng quan & 10 sơ đồ chi tiết
├── state-machine-simulator.html   # Trang mô phỏng tương tác
├── state-machines.css             # Thiết kế giao diện (Dark/Light theme)
├── state-machines.js              # Dữ liệu 10 máy, bộ vẽ SVG & engine mô phỏng
└── README.md                      # Tài liệu hướng dẫn
```

---

## 💻 Cách chạy tại máy (Local)

Vì đây là ứng dụng web tĩnh thuần (HTML/CSS/JS), bạn không cần cài đặt server hay database:
1. Mở trực tiếp file `index.html` bằng bất kỳ trình duyệt nào (Chrome, Edge, Firefox, Safari).
2. Hoặc dùng extension **Live Server** trên VS Code / WebStorm.
3. Hoặc chạy lệnh với Python:
   ```bash
   python -m http.server 8000
   ```
   Sau đó truy cập: `http://localhost:8000`
