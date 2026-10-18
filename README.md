# PanelForge · UML State Machines, Diagrams & Interactive Simulator

> **Dự án tốt nghiệp SEP490 · FA26SE251 · Hệ thống hỗ trợ sản xuất truyện tranh trực tuyến (PanelForge)**

Ứng dụng web trực quan hoá và mô phỏng tương tác toàn diện vòng đời trạng thái (**10 UML State Machines**) của hệ thống PanelForge. Dữ liệu, điều kiện kiểm tra (Guards), hành động thực thi (Actions) và các luật chuyển trạng thái được trích xuất và đối chiếu trực tiếp từ tầng **Domain** (`PanelForge.Domain`) và các **Command Handlers** (`PanelForge.Application`), bám sát nghiệp vụ trong **Phiếu đăng ký đề tài V1.2** và 24 quy tắc nghiệp vụ chuẩn (**BR-01 đến BR-24**).

---

## 🎯 Báo cáo kiểm tra tính đúng đắn của các luồng (Verification Summary)

Toàn bộ 10 State Machines trong dự án đã được rà soát và đối chiếu kỹ lưỡng với mã nguồn C# Backend:

| STT | Thực thể (State Machine) | Mã nguồn C# Backend | Trạng thái kiểm tra | Điểm cốt lõi & Cơ chế nghiệp vụ |
|:---:|:---|:---|:---:|:---|
| 1 | **Chapter** | `Content/Chapter.cs` | ✅ **Chính xác 100%** | Duyệt qua 4 cổng bảo vệ nghiêm ngặt (có Page, hết việc, hết CR, hết lỗi Blocking). Đóng băng bản thảo tạo `ChapterSnapshot` bất biến (CF4). Mở lại (Reopen) bắt buộc kèm lý do và **thu hồi toàn bộ link xem thử** (BR-17). Phát hành có hẹn giờ `PublishAt` (BR-23, BR-24). |
| 2 | **Assignment** | `Workflow/Assignment.cs` | ✅ **Chính xác 100%** | Kiểm tra đồ thị phụ thuộc đa nhiệm DAG (BR-19). Cấm tự duyệt bài chính mình làm (`ReviewRules`). Có đủ 3 nhánh mở lại việc `Approved → ReworkRequired`: từ duyệt cấp Chapter (`ReturnWorkFromReview`), phản hồi xem thử (`CreateChangeRequestFromFeedback`), và **lan truyền làm lại theo dây chuyền** (`Cascade Invalidation` BR-06). |
| 3 | **StageProgress** | `Workflow/StageProgress.cs` | ✅ **Chính xác 100%** | Ma trận tiến độ $(Panel \times Stage)$ cho phép song song hóa quy trình vẽ (BR-19). Tiến độ trang được suy ra từ stage thấp nhất của các panel. Cổng duyệt đạt chuẩn mới mở stage kế tiếp cho panel (BR-06). |
| 4 | **Submission** | `Workflow/Submission.cs` | ✅ **Chính xác 100%** | Bản nộp đóng vai trò Snapshot bất biến gắn chặt với phiên bản Chapter và artwork lúc nộp. Nộp lần mới tự động chuyển bản nộp cũ `Pending → Superseded`. Chống race condition với `expectedSubmissionId`. |
| 5 | **ChangeRequest** | `Workflow/ChangeRequest.cs` | ✅ **Chính xác 100%** | Hỗ trợ tọa độ vùng khoanh chuẩn hóa $\{x, y, w, h\} \in [0, 1]$ trên canvas. Chu trình chuẩn: `Open → Resolved → Verified`. Vòng lặp `Resolved → Open` khi sửa chưa đạt. Đóng vai trò cổng chặn duyệt nộp Assignment và duyệt Chapter. |
| 6 | **ConsistencyFinding** | `Content/ConsistencyFinding.cs` | ✅ **Chính xác 100%** | Kiểm tra 3 tầng (code deterministic, AI Continuity agent, visual check). Triage 4 nhánh của Editor (Confirmed, Rejected, Ignored có lý do BR-21, NeedsClarification có câu hỏi). Quét lại tự động: `Confirmed → Resolved`, `Open/Clarify → Stale`, `Resolved/Stale → Open` khi tái phát. Lỗi `Blocking` chặn duyệt Chapter. |
| 7 | **PreviewFeedback** | `Preview/PreviewFeedback.cs` | ✅ **Chính xác 100%** | Độc giả xem thử qua link có token, watermark và thời hạn truy cập (BR-09, BR-17). Triage `Noted` (để dành) hoặc `NeedsChange` (cần sửa). Chuyển thành `ChangeRequest` sau khi Producer Reopen Chapter, kéo các việc liên quan về `ReworkRequired`. |
| 8 | **AiWorkflowRun** | `Ai/AiWorkflowRun.cs` | ✅ **Chính xác 100%** | Tiến trình đa tác tử ngầm (Writer → Storyboard → Continuity → Lettering). Cập nhật `LastActivityAtUtc`. Giới hạn số vòng sửa `MaxRevisionRounds` (chuyển `WaitingForHuman` nếu còn lỗi). AI lỗi hoặc mất tín hiệu chuyển `Failed`/`Interrupted`, không làm sập quy trình thủ công (NFR). |
| 9 | **AiSuggestion** | `Ai/AiSuggestion.cs` | ✅ **Chính xác 100%** | Con người toàn quyền quyết định (Human-in-the-loop BR-02). Chấp thuận (`Accepted`) tạo `ContentRevision` mới (append-only, lưu hash SHA-256 và truy vết Provenance BR-01, BR-10). Kiểm soát xung đột phiên bản lạc quan (Optimistic Concurrency BR-11, trả về 409 nếu nội dung đã đổi). |
| 10 | **ExportJob** | `Publishing/ExportJob.cs` | ✅ **Chính xác 100%** | Render nền PDF, CBZ, WebP/PNG, JSON. Chỉ huỷ được khi còn `Queued` (đang `Processing` không cho huỷ - 409). Hoàn tất lưu hash SHA-256 (BR-04). Tải file an toàn qua API kiểm quyền (BR-16), tăng biến đếm `DownloadCount` và ghi Audit Log. |

---

## 🔗 5 Chuỗi điều phối liên hoàn (Cross-Entity Orchestration Pipelines)

Hệ thống kết nối 10 State Machines thành 5 chuỗi liên hoàn thống nhất:

```
[1. AI Pipeline]
AiWorkflowRun ──(Completed)──> AiSuggestion ──(Accepted)──> ContentRevision (Script/Layout)
                                                                    │
[2. Production Pipeline]                                             ▼
Chapter (InProduction) ──> Assignment (Assigned ──> InProgress) ──> StageProgress (Panel × Stage)
                                 │
[3. Gate & Review]               ▼
                          Submission (Pending) ──(Review)──> ChangeRequest (Open ──> Verified)
                                 │                                  ▲
[4. Feedback & Cascade]          ▼                                  │
PreviewLink ──> PreviewFeedback (NeedsChange) ──> Chapter Reopen ───┴──> Cascade Invalidation (BR-06)
                                 │
[5. Publishing]                  ▼
Chapter (Approved) ──(PublishChapter)──> Chapter (Published) ──> ExportJob ──> Public Catalog
```

1. **Chuỗi Hỗ trợ AI (Writer AI Loop):** `AiWorkflowRun` $\rightarrow$ `AiSuggestion` $\rightarrow$ `ContentRevision` $\rightarrow$ Cập nhật Script/Layout của Scene.
2. **Chuỗi Sản xuất & Phân rã tiến độ (Production Matrix):** `Chapter` $\rightarrow$ `Assignment` $\rightarrow$ Ma trận `StageProgress` cho từng $(Panel, Stage)$.
3. **Chuỗi Nộp bài & Cổng thẩm định (Review & Gate Checks):** `Submission` $\rightarrow$ `UnderReview` $\rightarrow$ `Approved` (mở stage kế) HOẶC trả về tạo `ChangeRequest` + `Submission` Rejected.
4. **Chuỗi Giám sát chất lượng & Lan truyền sửa đổi (QA & Cascade Rework):** `ConsistencyFinding` (chặn duyệt Chapter) + `PreviewFeedback` $\rightarrow$ `Reopen Chapter` (thu hồi PreviewLink BR-17) $\rightarrow$ `ChangeRequest` $\rightarrow$ `Cascade Invalidation` kéo các stage sau về `ReworkRequired` (BR-06).
5. **Chuỗi Đóng gói & Phát hành (Publishing Pipeline):** `Chapter Approved` $\rightarrow$ `PublishChapter` $\rightarrow$ `ExportJob` (PDF/CBZ/JSON) $\rightarrow$ Hiển thị trên Public Catalog sau `PublishedAt`.

---

## 📋 Ánh xạ Business Rules (BR-01 đến BR-24)

| Mã BR | Tên quy tắc nghiệp vụ | State Machine áp dụng trực tiếp |
|:---|:---|:---|
| **BR-01** | Bất biến lịch sử (Immutable History & Revisions) | `AiSuggestion`, `Chapter`, `Submission` |
| **BR-02** | Con người có thẩm quyền quyết định (Human-in-the-loop) | `AiSuggestion`, `AiWorkflowRun` |
| **BR-03** | Ràng buộc cấu trúc thực thể & DAG Dependencies | `Assignment`, `StageProgress` |
| **BR-04** | Kiểm tra toàn vẹn dữ liệu kết xuất bằng SHA-256 | `ExportJob`, `AiSuggestion` |
| **BR-06** | Lan truyền thay đổi dây chuyền (Cascade Invalidation) | `Assignment`, `StageProgress` |
| **BR-07** | Phân quyền vai trò Workspace khi giao việc | `Assignment` |
| **BR-09** | Quản lý vòng đời và bảo mật liên kết xem thử | `PreviewFeedback`, `Chapter` |
| **BR-10** | Truy vết xuất xứ nguồn gốc dữ liệu (Provenance) | `AiSuggestion`, `ContentRevision` |
| **BR-11** | Kiểm soát xung đột phiên bản đồng thời (Optimistic Concurrency) | `AiSuggestion` |
| **BR-12** | Đóng băng chỉnh sửa khi chương đã Approved (Read-Only Gate) | `Chapter`, `Assignment`, `ChangeRequest` |
| **BR-14** | Bắt buộc thông báo trước khi bắt đầu nhiệm vụ | `Assignment` |
| **BR-16** | Tải tài nguyên có kiểm quyền qua API trung gian | `ExportJob` |
| **BR-17** | Tự động thu hồi link xem thử khi mở lại chương | `Chapter`, `PreviewFeedback` |
| **BR-18** | Đảm bảo tính nguyên tử trong một Transaction duy nhất | `Chapter`, `Assignment`, `AiSuggestion` |
| **BR-19** | Tiến độ tính độc lập theo từng Panel, song song hóa việc | `Assignment`, `StageProgress` |
| **BR-20** | Rời công đoạn chỉ khi vượt qua cổng duyệt đạt chuẩn | `StageProgress` |
| **BR-21** | Bỏ qua cảnh báo nhất quán (Ignored) bắt buộc có lý do | `ConsistencyFinding` |
| **BR-23** | Kiểm soát hiển thị nội dung trên Public Catalog | `Chapter` |
| **BR-24** | Điều kiện phát hành có hẹn giờ (PublishAt >= Now) | `Chapter` |

---

## 🛠️ Cấu trúc thư mục ứng dụng

```text
├── index.html                     # Trang chủ điều hướng và tổng quan kiến trúc
├── state-machine-diagrams.html    # 10 Sơ đồ UML, Bảng định nghĩa State, Bảng Transition kèm giải thích
├── state-machine-simulator.html   # Bộ mô phỏng tương tác động (Simulator) kèm 25 kịch bản tự động
├── state-machines.css             # Thiết kế giao diện Design Tokens (Dark / Light mode)
├── state-machines.js              # Định nghĩa 10 State Machines, engine mô phỏng và SVG renderer
├── img/                           # 10 Ảnh sơ đồ xuất từ draw.io độ phân giải cao
└── README.md                      # Báo cáo kiểm tra và tài liệu thuyết minh kỹ thuật
```

---

## 💻 Cách chạy tại máy (Local)

Vì đây là ứng dụng web tĩnh thuần (HTML/CSS/JS), không cần cài đặt backend hay database:
1. Mở trực tiếp file `index.html` hoặc `state-machine-diagrams.html` bằng bất kỳ trình duyệt nào.
2. Hoặc chạy lệnh với Python:
   ```bash
   python -m http.server 8000
   ```
   Sau đó truy cập: `http://localhost:8000`
