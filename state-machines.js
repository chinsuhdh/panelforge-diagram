(() => {
  'use strict';
  // Helper functions
  const now = () => new Date().toLocaleTimeString('vi-VN');
  const filled = k => c => (c[k] || '').trim().length > 0;
  const G = (...rules) => c => { for (const [ok, msg] of rules) if (!ok(c)) return msg; return true; };

  const MACHINES = {
    chapter: {
      name: 'Chapter', vi: 'Chương truyện', file: 'Content/Chapter.cs', initial: 'InProduction', initEvent: 'create()',
      states: {
        InProduction: {
          vi: 'Đang sản xuất',
          act: 'do / vẽ, nộp, duyệt việc',
          desc: 'Chương đang trong giai đoạn sản xuất nội bộ: các thành viên (Writer, Artist, Letterer) thực hiện nhiệm vụ theo từng stage của panel. Mọi thao tác chỉnh sửa bài vẽ, nộp bài, thẩm định, và tạo ChangeRequest đều diễn ra tại trạng thái này. BR-12 bảo vệ quyền ghi.',
          col: 0, row: 0
        },
        Approved: {
          vi: 'Đã duyệt',
          act: 'entry / khoá chỉnh sửa',
          desc: 'Producer đã phê duyệt toàn bộ nội dung của chương sau khi thỏa mãn 4 cổng kiểm tra. Toàn bộ bài vẽ và công việc bị khóa chỉnh sửa (Read-Only theo BR-12). Hệ thống tạo ChapterSnapshot bất biến và lịch sử ChapterReview. Lúc này các link xem thử (PreviewLink) có thể được tạo để lấy ý kiến bên ngoài.',
          col: 1, row: 0
        },
        Published: {
          vi: 'Đã phát hành',
          act: 'entry / set PublishedAt',
          desc: 'Publisher đã kiểm duyệt bản hoàn chỉnh và lên lịch phát hành (PublishAt). Độc giả (Reader) chỉ có thể thấy và đọc chương trên Public Catalog khi chương ở trạng thái Published và thời gian hiện tại đã tới hoặc qua PublishedAt (BR-23, BR-24). Không thể mở lại một khi đã phát hành.',
          col: 2, row: 0, final: 'good'
        },
      },
      inputs: [
        { id: 'hasPage', label: 'Chương có ít nhất 1 Page', type: 'check', value: true },
        { id: 'allDone', label: 'Mọi Assignment đã Approved', type: 'check', value: true },
        { id: 'noOpenCR', label: 'Không còn CR Open/Resolved', type: 'check', value: true },
        { id: 'noBlocking', label: 'Không còn finding Blocking đang mở', type: 'check', value: true },
        { id: 'reason', label: 'Lý do mở lại / trả về', type: 'text', value: '' },
        { id: 'pastDate', label: 'Ngày phát hành nằm trong quá khứ', type: 'check', value: false },
      ],
      vars: { reviews: 0, publishedAt: null, previewLinks: 'active' },
      t: [
        { from: 'InProduction', to: 'Approved', ev: 'approve()', who: 'Producer', btn: 'Producer duyệt chương', src: 'ApproveChapterCommand',
          explain: 'Producer duyệt chương sau khi thỏa mãn 4 cổng: (1) có ít nhất 1 trang, (2) toàn bộ việc giao đã Approved, (3) không còn ChangeRequest nào đang Open hoặc Resolved, (4) không còn lỗi nhất quán mức Blocking chưa xử lý. Hệ thống tạo ChapterSnapshot bất biến (CF4) và khóa chỉnh sửa toàn bộ chương (BR-12).',
          g: ['hasPage && allAssignmentsApproved && noOpenCR && noBlockingFinding', G(
            [c => c.hasPage, 'Chapter chưa có Page nào, chưa thể duyệt.'],
            [c => c.allDone, 'Còn việc chưa được duyệt, chưa thể duyệt Chapter.'],
            [c => c.noOpenCR, 'Còn yêu cầu sửa chưa đóng, chưa thể duyệt Chapter.'],
            [c => c.noBlocking, 'Còn lỗi nhất quán mức Blocking đang mở (cổng Consistency).'])],
          a: ['addReview(); notify(Publisher)', c => c.reviews++] },
        { from: 'Approved', to: 'InProduction', ev: 'reopen(reason)', who: 'Producer / Publisher', btn: 'Mở lại / trả về', src: 'ReopenChapterCommand',
          explain: 'Producer tự mở lại để sửa hoặc Publisher từ chối duyệt phát hành. Bắt buộc phải có lý do (comment). Khi mở lại, toàn bộ link xem thử (PreviewLink) của bản này lập tức bị thu hồi để tránh rò rỉ (BR-17), chương trở lại InProduction cho phép chỉnh sửa.',
          g: ['reason != ""', G([filled('reason'), 'Mở lại / từ chối bắt buộc có lý do.'])],
          a: ['addReview(); revokePreviewLinks(); notify(Producer)', c => { c.reviews++; c.previewLinks = 'revoked'; }] },
        { from: 'Approved', to: 'Published', ev: 'publish(at)', who: 'Publisher', btn: 'Publisher phát hành', src: 'PublishChapterCommand',
          explain: 'Publisher phê duyệt bản cuối và ấn định thời điểm xuất bản (PublishAt). Nếu để trống sẽ phát hành ngay. Reader chỉ thấy chương trong catalog sau mốc thời gian này (BR-24).',
          g: ['publishAt >= now', G([c => !c.pastDate, 'Thời điểm phát hành không được ở quá khứ.'])],
          a: ['setPublishedAt(); notify(Producer)', c => c.publishedAt = now()] },
      ],
      notes: [
        'Trong InProduction, mỗi panel đi qua pipeline lõi trắng đen theo phiếu V1.2: Script → Thumbnail → Pencil → Ink → Letter → Review → Approved. Mẫu pipeline trong code seed thêm Color (phạm vi mở rộng, chế độ màu).',
        'BR-12: chương Approved chỉ đọc (Read-Only) cho tới khi được mở lại kèm lý do.',
        'BR-17: mở lại chương tự động thu hồi (revoke) toàn bộ PreviewLink đang hoạt động.',
        'BR-23, BR-24: chỉ chương Published và đã tới mốc PublishedAt mới hiển thị trong catalog cho Reader.',
        'C# Enum có giá trị Locked (giá trị 3) dành cho dự phòng tương lai, hiện tại trạng thái Approved đóng vai trò khóa chỉnh sửa theo BR-12.'
      ],
      flows: [
        { name: 'Luồng chuẩn', desc: 'Producer duyệt chương đã xong, Publisher lên lịch phát hành.', steps: [
          { ev: 'approve()', say: 'Mọi việc đã Approved, không còn CR hay lỗi Blocking, nên Producer duyệt chương. Chương bị khoá chỉnh sửa (BR-12) và Publisher được báo.' },
          { ev: 'publish(at)', say: 'Publisher kiểm tra rồi phát hành với ngày hợp lệ. Reader thấy chương từ PublishedAt (BR-24).' },
        ] },
        { name: 'Bị chặn vì còn CR', desc: 'Cổng duyệt chương không cho qua khi còn yêu cầu sửa chưa đóng.', steps: [
          { ev: 'approve()', set: { noOpenCR: false }, say: 'Còn một ChangeRequest đang Resolved chưa được Editor xác minh, guard chặn và chương vẫn ở InProduction.' },
          { ev: 'approve()', set: { noOpenCR: true }, say: 'Editor đã xác minh CR (Verified). Bấm duyệt lại thì qua được.' },
        ] },
        { name: 'Publisher trả về', desc: 'Publisher không đồng ý phát hành, trả chương kèm lý do.', steps: [
          { ev: 'approve()', say: 'Producer duyệt chương.' },
          { ev: 'reopen(reason)', set: { reason: '' }, say: 'Publisher bấm trả về nhưng để trống lý do, hệ thống chặn.' },
          { ev: 'reopen(reason)', set: { reason: 'Trang 5 thoại bị tràn bóng' }, say: 'Có lý do thì chương về InProduction, các link xem thử bị thu hồi và Producer được báo.' },
        ] },
      ],
    },
    assignment: {
      name: 'Assignment', vi: 'Nhiệm vụ phân công', file: 'Workflow/Assignment.cs', initial: 'Assigned', initEvent: 'assign()',
      states: {
        Assigned: {
          vi: 'Đã giao',
          act: 'entry / notify(assignee)',
          desc: 'Nhiệm vụ đã được Producer tạo và phân công cho thành viên có vai trò phù hợp trong Workspace (BR-07). Thành viên nhận được thông báo (BR-14) và chuẩn bị nhận việc.',
          col: 0, row: 0
        },
        InProgress: {
          vi: 'Đang làm',
          act: 'entry / set StartedAt',
          desc: 'Người được giao đang tích cực vẽ hoặc viết bài. Thời điểm bắt đầu (StartedAt) được ghi nhận. Hệ thống khởi tạo hoặc kích hoạt tiến độ (StageProgress) của các panel thuộc phạm vi nhiệm vụ.',
          col: 1, row: 0
        },
        Submitted: {
          vi: 'Đã nộp',
          act: 'entry / tạo Submission',
          desc: 'Người làm nộp bài sau khi hoàn thiện bản vẽ và xử lý hết các ChangeRequest Open. Hệ thống tạo một bản nộp mới (Submission) gắn với phiên bản Chapter và artwork tại thời điểm nộp (bản nộp cũ Pending chuyển Superseded). Tiến độ panel chuyển sang Submitted.',
          col: 2, row: 0
        },
        UnderReview: {
          vi: 'Đang duyệt',
          act: 'do / Editor review',
          desc: 'Editor (khác người làm) mở bài nộp ra thẩm định chất lượng trên canvas. Tiến độ các panel tương ứng chuyển sang InReview. Editor so sánh với Character Sheet, Bible và kiểm tra lỗi thoại/khung.',
          col: 2, row: 1
        },
        ReworkRequired: {
          vi: 'Cần làm lại',
          act: 'entry / lưu feedback',
          desc: 'Bài nộp chưa đạt chuẩn, bị Editor trả về kèm nhận xét và ChangeRequest; hoặc bị mở lại do lỗi phát hiện ở khâu duyệt chương (ReturnWorkFromReview), hoặc do stage trước bị sửa lại (Cascade Invalidation BR-06). Tiến độ panel chuyển sang ChangesRequested.',
          col: 1, row: 1
        },
        Approved: {
          vi: 'Đã duyệt',
          act: 'entry / set CompletedAt',
          desc: 'Editor đã duyệt đạt yêu cầu. Nhiệm vụ hoàn thành (CompletedAt). Bản nộp chuyển sang Approved và stage tiếp theo của các panel liên quan được mở khóa (BR-06).',
          col: 2, row: 2
        },
      },
      inputs: [
        { id: 'isAssignee', label: 'Người thao tác là người được giao', type: 'check', value: true },
        { id: 'depsDone', label: 'Việc phụ thuộc đã Approved (BR-19)', type: 'check', value: true },
        { id: 'editable', label: 'Chương đang InProduction (BR-12)', type: 'check', value: true },
        { id: 'noOpenCR', label: 'Không còn CR Open', type: 'check', value: true },
        { id: 'allCRClosed', label: 'Mọi CR đã đóng (Verified/Rejected)', type: 'check', value: true },
        { id: 'selfReview', label: 'Người duyệt chính là người làm', type: 'check', value: false },
        { id: 'feedback', label: 'Comment khi trả về', type: 'text', value: '' },
        { id: 'reopened', label: 'Chương đã được mở lại', type: 'check', value: true },
      ],
      vars: { startedAt: null, submissions: 0, completedAt: null, lastFeedback: null },
      t: [
        { from: 'Assigned', to: 'InProgress', ev: 'startWork()', who: 'Người được giao', btn: 'Bắt đầu làm', src: 'StartAssignmentCommand',
          explain: 'Người được giao bắt đầu làm việc khi thỏa mãn: đúng assignee, chương đang InProduction (BR-12), và mọi nhiệm vụ phụ thuộc trong đồ thị DAG đã Approved (BR-19).',
          g: ['isAssignee && notified && depsApproved && chapterEditable', G(
            [c => c.isAssignee, 'Chỉ người được giao mới bắt đầu được việc này.'],
            [c => c.editable, 'Chương không ở trạng thái InProduction (BR-12).'],
            [c => c.depsDone, 'Việc phụ thuộc chưa được duyệt (BR-19).'])],
          a: ['setStartedAt(); StageProgress.Begin()', c => c.startedAt = now()] },
        { from: 'InProgress', to: 'Submitted', ev: 'submit()', who: 'Người được giao', btn: 'Nộp bài', src: 'SubmitAssignmentCommand',
          explain: 'Người làm nộp bài khi đã xử lý hết các ChangeRequest Open (các CR đã Resolved thì được nộp). Hệ thống tạo bản Submission mới, đẩy StageProgress sang Submitted và báo cho Editor.',
          g: ['isAssignee && noOpenChangeRequest', G(
            [c => c.isAssignee, 'Chỉ người được giao mới nộp được việc này.'],
            [c => c.noOpenCR, 'Còn yêu cầu sửa chưa xử lý, hãy sửa và đánh dấu Resolved trước khi nộp lại.'])],
          a: ['createSubmission(); notify(Editor)', c => c.submissions++] },
        { from: 'Submitted', to: 'UnderReview', ev: 'openReview()', who: 'Editor', btn: 'Editor mở duyệt', src: 'OpenAssignmentReviewCommand',
          explain: 'Editor mở bài nộp ra duyệt. Quy tắc cấm tự duyệt (Reviewer != Assignee) bảo đảm tính khách quan thẩm định.',
          g: ['reviewer != assignee', G([c => !c.selfReview, 'Không thể tự duyệt việc do chính mình được giao.'])] },
        { from: 'UnderReview', to: 'Approved', ev: 'approve()', who: 'Editor', btn: 'Duyệt đạt', src: 'ApproveAssignmentCommand',
          explain: 'Editor duyệt đạt khi mọi ChangeRequest đã đóng (Verified hoặc Rejected). Submission và StageProgress của các panel chuyển Approved, mở khóa stage kế (BR-06).',
          g: ['reviewer != assignee && allChangeRequestsClosed', G(
            [c => !c.selfReview, 'Không thể tự duyệt việc do chính mình được giao.'],
            [c => c.allCRClosed, 'Còn yêu cầu sửa chưa đóng (Open, hoặc Resolved chưa xác minh), chưa thể duyệt.'])],
          a: ['Submission.Approve(); StageProgress → Approved', c => c.completedAt = now()] },
        { from: 'UnderReview', to: 'ReworkRequired', ev: 'requestRework()', who: 'Editor', btn: 'Trả về làm lại', src: 'RequestAssignmentChangesCommand',
          explain: 'Editor trả về bắt buộc có comment, tự động tạo ChangeRequest (kèm tọa độ vùng khoanh nếu có), Submission chuyển Rejected, StageProgress chuyển ChangesRequested.',
          g: ['comment != ""', G([filled('feedback'), 'Trả về bắt buộc phải có comment.'])],
          a: ['Submission.Reject(); tạo ChangeRequest', c => c.lastFeedback = c.feedback.trim()] },
        { from: 'ReworkRequired', to: 'InProgress', ev: 'startWork()', who: 'Người được giao', btn: 'Làm lại', src: 'StartAssignmentCommand',
          explain: 'Người làm tiếp thu góp ý và bắt đầu sửa lại. StageProgress được phục hồi về InProgress qua Resume().',
          g: ['isAssignee && chapterEditable', G([c => c.isAssignee, 'Chỉ người được giao mới bắt đầu được việc này.'], [c => c.editable, 'Chương không ở trạng thái InProduction (BR-12).'])],
          a: ['StageProgress.Resume()', c => c.startedAt = now()] },
        { from: 'Approved', to: 'ReworkRequired', ev: 'reworkFromFeedback()', who: 'Producer / Editor', btn: 'Trả lại từ phản hồi xem thử', src: 'CreateChangeRequestFromFeedbackCommand / ReturnWorkFromReviewCommand',
          explain: 'Việc đã duyệt bị mở lại để sửa từ 3 nguồn: (1) Editor duyệt cấp Chapter trả về qua ReturnWorkFromReviewCommand, (2) Producer chuyển phản hồi xem thử thành CR sau khi Reopen chương, (3) Luật lan truyền thay đổi BR-06 khi stage trước của cùng panel bị trả về làm lại.',
          g: ['chapter reopened', G([c => c.reopened, 'Chương chưa được mở lại, không chuyển phản hồi thành yêu cầu sửa được.'])],
          a: ['tạo ChangeRequest; StageProgress → ChangesRequested', c => c.lastFeedback = 'Từ phản hồi xem thử'] },
      ],
      notes: [
        'BR-14: việc được giao phải có thông báo trước khi bắt đầu.',
        'BR-19: phụ thuộc xét theo từng việc theo đồ thị DAG, việc độc lập chạy song song.',
        'BR-06: lan truyền thay đổi (Cascade Invalidation) – khi stage trước của Panel bị sửa lại, các Assignment stage sau đã Approved tự động bị chuyển về ReworkRequired.',
        'Phiếu V1.2 & ReviewRules: Editor duyệt hoặc trả về một stage, nghiêm cấm tự duyệt việc chính mình làm.',
        'Enum có trạng thái Blocked (giá trị 7) đại diện cho công việc bị tạm dừng/chặn do phụ thuộc hoặc vấn đề kỹ thuật.'
      ],
      flows: [
        { name: 'Luồng chuẩn', desc: 'Từ lúc giao việc tới lúc Editor duyệt đạt.', steps: [
          { ev: 'startWork()', say: 'Artist đã nhận thông báo (BR-14), việc phụ thuộc đã xong (BR-19), nên bắt đầu làm. StageProgress của các panel chuyển sang InProgress.' },
          { ev: 'submit()', say: 'Artist nộp bài. Hệ thống tạo một Submission gắn với phiên bản hiện tại và báo cho Editor.' },
          { ev: 'openReview()', say: 'Editor (không phải người làm) mở bài ra duyệt.' },
          { ev: 'approve()', say: 'Không còn yêu cầu sửa nào mở, Editor duyệt đạt. Submission được Approved và stage kế tiếp của các panel mở ra.' },
        ] },
        { name: 'Bị trả về rồi nộp lại', desc: 'Vòng làm lại: trả về kèm comment, sửa, nộp lại, duyệt.', steps: [
          { ev: 'startWork()', say: 'Artist bắt đầu làm.' },
          { ev: 'submit()', say: 'Artist nộp bản đầu.' },
          { ev: 'openReview()', say: 'Editor mở duyệt.' },
          { ev: 'requestRework()', set: { feedback: '' }, say: 'Editor bấm trả về nhưng chưa ghi comment, hệ thống chặn.' },
          { ev: 'requestRework()', set: { feedback: 'Panel 3 sai tóc nhân vật', noOpenCR: false, allCRClosed: false }, say: 'Có comment thì việc về ReworkRequired, Submission bị Rejected và một ChangeRequest Open được tạo.' },
          { ev: 'startWork()', say: 'Artist làm lại.' },
          { ev: 'submit()', say: 'Artist nộp lại khi CR vẫn còn Open, hệ thống chặn: phải sửa và đánh dấu Resolved trước.' },
          { ev: 'submit()', set: { noOpenCR: true }, say: 'Artist đánh dấu CR là Resolved rồi nộp lại được.' },
          { ev: 'openReview()', say: 'Editor mở duyệt lần hai.' },
          { ev: 'approve()', say: 'CR mới Resolved, Editor chưa xác minh, nên chưa duyệt được.' },
          { ev: 'approve()', set: { allCRClosed: true }, say: 'Editor xác minh CR (Verified) rồi duyệt đạt.' },
        ] },
        { name: 'Vi phạm ràng buộc', desc: 'Các trường hợp handler từ chối.', steps: [
          { ev: 'submit()', say: 'Nộp khi chưa bắt đầu: không có transition từ Assigned (handler báo "Phải bắt đầu việc trước khi nộp").' },
          { ev: 'startWork()', set: { depsDone: false }, say: 'Việc Pencil phụ thuộc Thumbnail chưa duyệt, nên chưa bắt đầu được (BR-19).' },
          { ev: 'startWork()', set: { depsDone: true }, say: 'Thumbnail đã được duyệt, bắt đầu được.' },
          { ev: 'submit()', say: 'Nộp bài.' },
          { ev: 'openReview()', set: { selfReview: true }, say: 'Người làm tự mở duyệt bài mình: bị cấm.' },
          { ev: 'openReview()', set: { selfReview: false }, say: 'Một Editor khác mở duyệt.' },
        ] },
        { name: 'Trả lại sau khi đã duyệt', desc: 'Phản hồi xem thử hoặc duyệt chapter kéo một việc đã Approved về làm lại.', steps: [
          { ev: 'startWork()', say: 'Bắt đầu làm.' }, { ev: 'submit()', say: 'Nộp bài.' }, { ev: 'openReview()', say: 'Editor mở duyệt.' },
          { ev: 'approve()', say: 'Việc được duyệt.' },
          { ev: 'reworkFromFeedback()', say: 'Người xem thử báo lỗi, Producer mở lại chương rồi chuyển phản hồi thành ChangeRequest. Việc về ReworkRequired, StageProgress về ChangesRequested.' },
        ] },
      ],
    },
    stage: {
      name: 'StageProgress', vi: 'Tiến độ Panel × Stage', file: 'Workflow/StageProgress.cs', initial: 'InProgress', initEvent: 'begin()',
      states: {
        InProgress: {
          vi: 'Đang làm',
          act: 'do / làm stage của panel',
          desc: 'Panel đang được thực hiện ở công đoạn (stage) này (ví dụ: đang phác thảo chì cho Panel 2). Được kích hoạt tự động khi Assignment tương ứng bắt đầu làm việc (ApplyAsync).',
          col: 0, row: 0
        },
        Submitted: {
          vi: 'Đã nộp',
          act: 'entry / set SubmittedBy',
          desc: 'Panel đã hoàn thành công đoạn này và được nộp cùng Assignment để chờ Editor thẩm định chất lượng trên canvas.',
          col: 1, row: 0
        },
        InReview: {
          vi: 'Đang duyệt',
          act: 'do / Editor review',
          desc: 'Panel đang được Editor xem xét trên giao diện kiểm duyệt, so sánh nét vẽ, bố cục và thoại với Character Sheet và Bible.',
          col: 2, row: 0
        },
        ChangesRequested: {
          vi: 'Cần sửa',
          act: 'entry / chờ làm lại',
          desc: 'Panel bị trả về làm lại do Editor yêu cầu chỉnh sửa, hoặc do stage trước đó bị làm lại khiến panel này bị ảnh hưởng dây chuyền (Cascade Invalidation BR-06).',
          col: 1, row: 1
        },
        Approved: {
          vi: 'Đạt stage',
          act: 'entry / mở stage kế',
          desc: 'Panel đã vượt qua cổng duyệt của stage hiện tại, mở khóa cho panel này chuyển sang stage tiếp theo trong pipeline (ví dụ: xong Pencil thì mở Ink theo BR-06).',
          col: 2, row: 1
        },
      },
      inputs: [],
      vars: { stage: 'Pencil', submittedBy: null, rounds: 0 },
      t: [
        { from: 'InProgress', to: 'Submitted', ev: 'submit(user)', who: 'Người được giao (qua submit Assignment)', btn: 'Nộp stage', src: 'StageProgressRules.ApplyAsync',
          explain: 'Panel hoàn thành công đoạn và nộp cùng Assignment để chờ Editor thẩm định.',
          a: ['setSubmittedBy()', c => { c.submittedBy = 'artist01'; c.rounds++; }] },
        { from: 'Submitted', to: 'InReview', ev: 'openReview()', who: 'Editor (qua openReview Assignment)', btn: 'Mở duyệt', src: 'OpenAssignmentReviewCommand',
          explain: 'Editor mở duyệt bài nộp, panel chuyển sang trạng thái đang kiểm duyệt trên canvas.' },
        { from: 'InReview', to: 'Approved', ev: 'approve()', who: 'Editor (cổng duyệt)', btn: 'Duyệt đạt', src: 'ApproveAssignmentCommand',
          explain: 'Panel vượt qua cổng duyệt đạt chuẩn, mở khóa cho panel này chuyển sang stage tiếp theo trong quy trình sản xuất (BR-06).',
          a: ['mở stage kế của panel (BR-06)', c => c.stage = 'Ink'] },
        { from: 'InReview', to: 'ChangesRequested', ev: 'requestChanges()', who: 'Editor', btn: 'Yêu cầu sửa', src: 'RequestAssignmentChangesCommand',
          explain: 'Editor yêu cầu chỉnh sửa nét vẽ hoặc thoại của panel, panel chuyển sang trạng thái chờ sửa.' },
        { from: 'ChangesRequested', to: 'InProgress', ev: 'resume()', who: 'Người được giao (startWork lại)', btn: 'Làm lại', src: 'StageProgressRules.ApplyAsync',
          explain: 'Người làm bắt đầu sửa lại panel (đồng bộ khi bấm startWork trên Assignment).' },
        { from: 'Approved', to: 'ChangesRequested', ev: 'reopenForRework()', who: 'Producer / Editor', btn: 'Mở lại để sửa', src: 'CreateChangeRequestFromFeedbackCommand / ReturnWorkFromReviewCommand',
          explain: 'Panel đã đạt stage bị mở lại để vẽ lại do yêu cầu sửa từ khâu duyệt cấp Chapter hoặc do stage trước đó bị làm lại (Cascade Invalidation BR-06).' },
      ],
      notes: [
        'Không có bản ghi StageProgress trong DB nghĩa là NotStarted.',
        'BR-06, BR-20: chỉ rời stage hiện tại khi cổng duyệt đạt chuẩn.',
        'BR-19: tiến độ tính độc lập theo từng Panel, các panel độc lập chạy song song.',
        'Trạng thái đi cùng Assignment: mỗi lệnh trên Assignment chuyển các dòng StageProgress của panel liên quan.',
        'Tiến độ của Page được suy ra từ stage thấp nhất của các Panel thuộc trang đó.'
      ],
      flows: [
        { name: 'Một panel qua một stage', desc: 'Panel đi hết cổng duyệt và mở stage kế.', steps: [
          { ev: 'submit(user)', say: 'Artist nộp việc Pencil, dòng StageProgress của panel chuyển Submitted.' },
          { ev: 'openReview()', say: 'Editor mở duyệt, panel chuyển InReview.' },
          { ev: 'approve()', say: 'Cổng đạt, panel chuyển Approved và stage Ink của panel này mở ra (BR-06).' },
        ] },
        { name: 'Sửa rồi duyệt lại', desc: 'Editor yêu cầu sửa, panel quay về làm lại.', steps: [
          { ev: 'submit(user)', say: 'Nộp.' }, { ev: 'openReview()', say: 'Mở duyệt.' },
          { ev: 'requestChanges()', say: 'Editor yêu cầu sửa, panel chuyển ChangesRequested.' },
          { ev: 'resume()', say: 'Artist bắt đầu làm lại, panel về InProgress.' },
          { ev: 'submit(user)', say: 'Nộp lại.' }, { ev: 'openReview()', say: 'Mở duyệt.' }, { ev: 'approve()', say: 'Đạt.' },
        ] },
      ],
    },
    submission: {
      name: 'Submission', vi: 'Lần nộp bài', file: 'Workflow/Submission.cs', initial: 'Pending', initEvent: 'submit()',
      states: {
        Pending: {
          vi: 'Chờ quyết định',
          act: 'do / chờ Editor',
          desc: 'Bản nộp đang chờ Editor xem xét và đưa ra quyết định (duyệt hoặc trả về). Gắn chặt với version của Chapter và artwork lúc nộp.',
          col: 0, row: 1
        },
        Approved: {
          vi: 'Được duyệt',
          act: 'entry / set DecidedBy',
          desc: 'Bản nộp được Editor chấp thuận đạt chuẩn chất lượng. Ghi nhận DecidedBy và khóa vĩnh viễn không sửa.',
          col: 1, row: 0, final: 'good'
        },
        Rejected: {
          vi: 'Bị trả về',
          act: 'entry / lưu comment',
          desc: 'Bản nộp bị từ chối do không đạt chuẩn hoặc có lỗi, lưu vết phản hồi của Editor để đối chiếu khi nộp lại.',
          col: 1, row: 1, final: 'bad'
        },
        Superseded: {
          vi: 'Bị thay thế',
          act: 'entry / bản mới thay',
          desc: 'Bản nộp cũ đang Pending bị hệ thống tự động thay thế khi người làm nộp lên một phiên bản mới hơn, ngăn chặn việc Editor duyệt nhầm bản cũ.',
          col: 1, row: 2, final: 'bad'
        },
      },
      inputs: [{ id: 'comment', label: 'Comment khi trả về', type: 'text', value: '' }],
      vars: { version: 1, decidedBy: null },
      t: [
        { from: 'Pending', to: 'Approved', ev: 'approve(user)', who: 'Editor (duyệt Assignment)', btn: 'Duyệt', src: 'ApproveAssignmentCommand',
          explain: 'Editor duyệt đạt Assignment, bản nộp được chấp nhận và khóa vĩnh viễn (lưu DecidedBy).',
          a: ['setDecidedBy()', c => c.decidedBy = 'editor01'] },
        { from: 'Pending', to: 'Rejected', ev: 'reject(comment)', who: 'Editor (trả về Assignment)', btn: 'Trả về', src: 'RequestAssignmentChangesCommand',
          explain: 'Editor trả về Assignment, bản nộp bị từ chối kèm comment phản hồi lưu vết.',
          g: ['comment != ""', G([filled('comment'), 'Trả về bắt buộc phải có comment.'])], a: ['setDecidedBy()', c => c.decidedBy = 'editor01'] },
        { from: 'Pending', to: 'Superseded', ev: 'supersede()', who: 'Hệ thống (khi người làm nộp lần mới)', btn: 'Có bản nộp mới', src: 'ChangeRequestRules.RecordSubmissionAsync',
          explain: 'Người làm nộp lên một bản mới hơn, bản nộp Pending cũ tự động bị thay thế để tránh duyệt nhầm bản cũ.',
          a: ['tạo Submission v+1', c => c.version++] },
      ],
      notes: [
        'Mỗi Submission gắn với phiên bản Chapter và artwork lúc nộp (phiếu V1.2: "each submission is bound to its version").',
        'Chỉ quyết định được khi đang ở trạng thái Pending.',
        'Cơ chế chống race condition: SubmissionMismatchAsync kiểm tra expectedSubmissionId để tránh Editor duyệt nhầm bản cũ khi đã có bản nộp mới.'
      ],
      flows: [
        { name: 'Được duyệt', desc: 'Lần nộp được Editor chấp nhận.', steps: [{ ev: 'approve(user)', say: 'Editor duyệt Assignment, Submission mới nhất chuyển Approved.' }] },
        { name: 'Bị trả về', desc: 'Editor trả về, bắt buộc có comment.', steps: [
          { ev: 'reject(comment)', set: { comment: '' }, say: 'Thiếu comment nên bị chặn.' },
          { ev: 'reject(comment)', set: { comment: 'Sai tỉ lệ khung' }, say: 'Có comment thì Submission chuyển Rejected.' },
        ] },
      ],
    },
    cr: {
      name: 'ChangeRequest', vi: 'Yêu cầu sửa', file: 'Workflow/ChangeRequest.cs', initial: 'Open', initEvent: 'create()',
      states: {
        Open: {
          vi: 'Đang mở',
          act: 'do / người làm sửa',
          desc: 'Yêu cầu sửa đang chờ người chịu trách nhiệm (Assignee) khắc phục. Có thể chứa tọa độ vùng khoanh {x, y, w, h} (0..1) trên ảnh gốc và link đến Panel/AssetReference. Trạng thái này chặn nộp lại Assignment.',
          col: 0, row: 0
        },
        Resolved: {
          vi: 'Đã sửa',
          act: 'entry / notify người tạo',
          desc: 'Người làm đã sửa xong lỗi và bấm xác nhận hoàn thành kèm ghi chú (ResolutionNote). Thông báo được gửi đến Editor để xác minh lại. Trạng thái này vẫn chặn duyệt cổng Assignment và Chapter.',
          col: 1, row: 0
        },
        Verified: {
          vi: 'Đã xác minh',
          act: 'entry / set VerifiedBy',
          desc: 'Editor kiểm tra lại phần sửa đổi và xác nhận đạt yêu cầu. Yêu cầu sửa chính thức đóng thành công, cho phép duyệt bài.',
          col: 2, row: 0, final: 'good'
        },
        Rejected: {
          vi: 'Đóng, không sửa',
          act: 'entry / lưu reason',
          desc: 'Editor hủy bỏ yêu cầu sửa kèm lý do (ví dụ: sau khi trao đổi thấy phương án cũ vẫn hợp lý hơn hoặc lỗi không đáng kể). Yêu cầu sửa đóng mà không cần sửa đổi.',
          col: 0, row: 1, final: 'bad'
        },
      },
      inputs: [
        { id: 'isOwner', label: 'Người thao tác là người chịu trách nhiệm', type: 'check', value: true },
        { id: 'otherEditor', label: 'Người duyệt khác người chịu trách nhiệm', type: 'check', value: true },
        { id: 'comment', label: 'Comment / lý do', type: 'text', value: '' },
      ],
      vars: { verifiedBy: null, reopenCount: 0 },
      t: [
        { from: 'Open', to: 'Resolved', ev: 'resolve(note)', who: 'Người chịu trách nhiệm', btn: 'Báo đã sửa', src: 'ResolveChangeRequestCommand',
          explain: 'Người chịu trách nhiệm (Assignee) sửa xong lỗi và báo đã sửa kèm ghi chú giải trình (ResolutionNote).',
          g: ['actor == assignee', G([c => c.isOwner, 'Chỉ người chịu trách nhiệm mới đánh dấu đã sửa.'])], a: ['notify(người tạo)', () => {}] },
        { from: 'Resolved', to: 'Verified', ev: 'verify(user)', who: 'Editor', btn: 'Xác minh đạt', src: 'VerifyChangeRequestCommand',
          explain: 'Editor (khác người làm) xác minh phần sửa đổi đã đạt yêu cầu. CR chính thức đóng (IsClosed = true), mở cổng duyệt.',
          g: ['verifier != assignee', G([c => c.otherEditor, 'Không thể tự xác minh yêu cầu sửa của chính mình.'])], a: ['setVerifiedBy()', c => c.verifiedBy = 'editor01'] },
        { from: 'Resolved', to: 'Open', ev: 'reopen(comment)', who: 'Editor', btn: 'Chưa đạt, mở lại', src: 'ReopenChangeRequestCommand',
          explain: 'Editor thấy phần sửa đổi chưa đạt, mở lại yêu cầu sửa bắt buộc kèm comment chỉ rõ điểm thiếu sót.',
          g: ['comment != "" && actor != assignee', G([filled('comment'), 'Mở lại bắt buộc có comment.'], [c => c.otherEditor, 'Không thể tự mở lại yêu cầu sửa của chính mình.'])],
          a: ['reopenCount++; notify(người làm)', c => c.reopenCount++] },
        { from: 'Open', to: 'Rejected', ev: 'reject(reason)', who: 'Editor', btn: 'Đóng, không sửa', src: 'RejectChangeRequestCommand',
          explain: 'Editor hủy bỏ yêu cầu sửa kèm lý do (ví dụ: phương án cũ vẫn được chấp nhận hoặc lỗi không đáng kể).',
          g: ['reason != "" && actor != assignee', G([filled('comment'), 'Đóng yêu cầu bắt buộc có lý do.'], [c => c.otherEditor, 'Không thể tự đóng yêu cầu sửa của chính mình.'])] },
      ],
      notes: [
        'Phiếu V1.2: change request gắn vùng, đi theo chu trình open → resolved → verified.',
        'Hỗ trợ vùng khoanh JSON { "x", "y", "w", "h" } theo tọa độ chuẩn hóa 0..1 của ảnh gốc.',
        'Nguồn tạo: Editor trả về bài nộp, hoặc phản hồi xem thử cần sửa, hoặc Editor duyệt cấp Chapter trả về.',
        'Cổng duyệt Assignment và Chapter chỉ mở khi mọi CR đã Verified hoặc Rejected.'
      ],
      flows: [
        { name: 'Sửa và xác minh', desc: 'Chu trình chuẩn open → resolved → verified.', steps: [
          { ev: 'resolve(note)', say: 'Artist sửa xong và đánh dấu Resolved, người tạo yêu cầu được báo.' },
          { ev: 'verify(user)', say: 'Editor (khác Artist) xác minh đạt, CR đóng ở Verified.' },
        ] },
        { name: 'Chưa đạt, mở lại', desc: 'Editor thấy sửa chưa đúng.', steps: [
          { ev: 'resolve(note)', say: 'Artist báo đã sửa.' },
          { ev: 'reopen(comment)', set: { comment: '' }, say: 'Mở lại mà không ghi comment: bị chặn.' },
          { ev: 'reopen(comment)', set: { comment: 'Màu tóc vẫn sai' }, say: 'Có comment thì CR về Open và Artist được báo.' },
          { ev: 'resolve(note)', say: 'Artist sửa lần hai.' },
          { ev: 'verify(user)', set: { otherEditor: false }, say: 'Chính Artist tự xác minh: bị cấm.' },
          { ev: 'verify(user)', set: { otherEditor: true }, say: 'Editor xác minh đạt.' },
        ] },
      ],
    },
    finding: {
      name: 'ConsistencyFinding', vi: 'Lỗi nhất quán', file: 'Content/ConsistencyFinding.cs', initial: 'Open', initEvent: 'detect()',
      states: {
        Confirmed: {
          vi: 'Xác nhận lỗi',
          act: 'entry / set TriagedBy',
          desc: 'Editor đã xác nhận đây là lỗi thực tế cần sửa (ví dụ: mâu thuẫn màu mắt, sai mốc thời gian, tên nhân vật viết sai). Sẽ tự động chuyển Resolved khi quét lại không còn lỗi.',
          col: 0, row: 0
        },
        Rejected: {
          vi: 'Không phải lỗi',
          act: 'entry / set TriagedBy',
          desc: 'Editor kết luận đây là cảnh báo giả (false positive). Hệ thống ghi nhớ mã Fingerprint và không báo lại trong các lần quét sau.',
          col: 1, row: 0, final: 'bad'
        },
        Ignored: {
          vi: 'Bỏ qua',
          act: 'entry / lưu lý do',
          desc: 'Editor chấp nhận bỏ qua cảnh báo này (bắt buộc phải ghi lý do theo BR-21, ví dụ: nhân vật cố ý cải trang). Không báo lại lần sau.',
          col: 2, row: 0, final: 'bad'
        },
        Resolved: {
          vi: 'Đã khắc phục',
          act: 'entry / set ResolvedAt',
          desc: 'Hệ thống quét lại kịch bản/bản vẽ và không còn phát hiện lỗi này nữa. Trạng thái tự động chuyển từ Confirmed sang Resolved.',
          col: 0, row: 1
        },
        Open: {
          vi: 'Chờ phân loại',
          act: 'do / Editor triage',
          desc: 'Lỗi nhất quán do hệ thống tự động phát hiện qua 3 tầng (luật code, AI Continuity, so sánh trực quan). Chờ Editor phân loại (triage). Nhận diện qua mã băm Fingerprint.',
          col: 1, row: 1
        },
        Stale: {
          vi: 'Hết hiệu lực',
          act: 'entry / nguồn đã đổi',
          desc: 'Nguồn kịch bản hoặc Bible đã bị sửa đổi/viết lại khiến ngữ cảnh của lỗi biến mất (chuyển tự động từ Open hoặc NeedsClarification sang Stale).',
          col: 1, row: 2
        },
        NeedsClarification: {
          vi: 'Cần làm rõ',
          act: 'entry / lưu câu hỏi',
          desc: 'Editor chưa chắc chắn, cần tham vấn Writer hoặc Producer (bắt buộc ghi câu hỏi cụ thể). Nếu lỗi mức Blocking thì vẫn chặn duyệt chương.',
          col: 2, row: 2
        },
      },
      inputs: [
        { id: 'note', label: 'Ghi chú (lý do / câu hỏi)', type: 'text', value: '' },
        { id: 'stillThere', label: 'Lần kiểm tra lại vẫn thấy lỗi', type: 'check', value: false }
      ],
      vars: { triagedBy: null },
      t: [
        { from: 'Open', to: 'Confirmed', ev: 'triage(Confirmed)', who: 'Editor / Producer', btn: 'Xác nhận lỗi', src: 'TriageConsistencyFindingCommand',
          explain: 'Editor xác nhận đây là lỗi thực tế cần sửa (ví dụ: mâu thuẫn màu mắt, sai mốc thời gian, tên nhân vật viết sai).',
          a: ['setTriagedBy()', c => c.triagedBy = 'editor01'] },
        { from: 'Open', to: 'Rejected', ev: 'triage(Rejected)', who: 'Editor / Producer', btn: 'Không phải lỗi', src: 'TriageConsistencyFindingCommand',
          explain: 'Editor kết luận là cảnh báo giả (false positive). Hệ thống ghi nhớ mã Fingerprint và không báo lại trong các lần quét sau.',
          a: ['setTriagedBy()', c => c.triagedBy = 'editor01'] },
        { from: 'Open', to: 'Ignored', ev: 'triage(Ignored)', who: 'Editor / Producer', btn: 'Bỏ qua', src: 'TriageConsistencyFindingCommand',
          explain: 'Editor chấp nhận bỏ qua cảnh báo này (bắt buộc phải ghi lý do theo BR-21, ví dụ: nhân vật cố ý cải trang). Không báo lại lần sau.',
          g: ['note != "" (BR-21)', G([filled('note'), 'Bỏ qua lỗi bắt buộc ghi lý do (BR-21).'])], a: ['setTriagedBy()', c => c.triagedBy = 'editor01'] },
        { from: 'Open', to: 'NeedsClarification', ev: 'triage(Clarify)', who: 'Editor / Producer', btn: 'Cần làm rõ', src: 'TriageConsistencyFindingCommand', lo: [60, 22],
          explain: 'Editor chưa rõ ngữ cảnh, đặt câu hỏi làm rõ để Writer hoặc Producer giải đáp trước khi kết luận.',
          g: ['note != ""', G([filled('note'), 'Cần làm rõ bắt buộc ghi câu hỏi cụ thể.'])] },
        { from: 'Confirmed', to: 'Resolved', ev: 'recheck()', who: 'Hệ thống (chạy kiểm tra lại)', btn: 'Kiểm tra lại', src: 'RunConsistencyCheckCommand',
          explain: 'Hệ thống quét lại và xác nhận lỗi không còn tồn tại nữa (đã được sửa xong).',
          g: ['!stillDetected', G([c => !c.stillThere, 'Lỗi vẫn còn, giữ nguyên.'])] },
        { from: 'Open', to: 'Stale', ev: 'recheck()', who: 'Hệ thống (chạy kiểm tra lại)', btn: 'Kiểm tra lại', src: 'RunConsistencyCheckCommand',
          explain: 'Nguồn kịch bản đã bị sửa đổi/viết lại khiến ngữ cảnh lỗi không còn (Finding tự hết hiệu lực).',
          g: ['!stillDetected', G([c => !c.stillThere, 'Lỗi vẫn còn, giữ nguyên.'])] },
        { from: 'NeedsClarification', to: 'Stale', ev: 'recheck()', who: 'Hệ thống (chạy kiểm tra lại)', btn: 'Kiểm tra lại', src: 'RunConsistencyCheckCommand',
          explain: 'Ngữ cảnh của câu hỏi làm rõ không còn tồn tại do nguồn đã thay đổi.',
          g: ['!stillDetected', G([c => !c.stillThere, 'Lỗi vẫn còn, giữ nguyên.'])] },
        { from: 'Resolved', to: 'Open', ev: 'redetected()', who: 'Hệ thống (chạy kiểm tra lại)', btn: 'Lỗi xuất hiện lại', src: 'RunConsistencyCheckCommand',
          explain: 'Lỗi đã từng khắc phục nhưng một lần chỉnh sửa sau đó làm lỗi xuất hiện trở lại.',
          g: ['stillDetected', G([c => c.stillThere, 'Lần kiểm tra không thấy lỗi.'])] },
        { from: 'Stale', to: 'Open', ev: 'redetected()', who: 'Hệ thống (chạy kiểm tra lại)', btn: 'Lỗi xuất hiện lại', src: 'RunConsistencyCheckCommand',
          explain: 'Lỗi đã từng hết hiệu lực nhưng thay đổi mới lại làm phát sinh đúng mẫu lỗi đó.',
          g: ['stillDetected', G([c => c.stillThere, 'Lần kiểm tra không thấy lỗi.'])] },
      ],
      notes: [
        'Phiếu V1.2: kiểm tra 3 lớp (luật trong code, Continuity agent trích dẫn bằng chứng, so ảnh với character sheet đã khoá).',
        'BR-21: Ignored bắt buộc lý do. Chỉ con người kết luận, AI và code chỉ phát hiện.',
        'Mức độ: Info, Warning, Blocking. Finding Blocking còn Open, Confirmed hoặc NeedsClarification sẽ chặn duyệt Chapter (ApproveChapterCommand).'
      ],
      flows: [
        { name: 'Lỗi thật được sửa', desc: 'Phát hiện → xác nhận → sửa → kiểm tra lại hết lỗi.', steps: [
          { ev: 'triage(Confirmed)', say: 'Continuity agent báo "tên nhân vật sai ở Scene 4". Editor xem bằng chứng và xác nhận là lỗi.' },
          { ev: 'recheck()', set: { stillThere: true }, say: 'Chạy kiểm tra lại khi Writer chưa sửa: lỗi vẫn còn nên guard chặn.' },
          { ev: 'recheck()', set: { stillThere: false }, say: 'Writer sửa xong, kiểm tra lại không thấy lỗi nên chuyển Resolved.' },
        ] },
        { name: 'Bỏ qua có lý do', desc: 'BR-21: bỏ qua phải ghi lý do.', steps: [
          { ev: 'triage(Ignored)', set: { note: '' }, say: 'Bỏ qua mà không ghi lý do: bị chặn (BR-21).' },
          { ev: 'triage(Ignored)', set: { note: 'Cố ý: nhân vật cải trang' }, say: 'Có lý do thì finding đóng ở Ignored.' },
        ] },
        { name: 'Hết hiệu lực rồi xuất hiện lại', desc: 'Nguồn thay đổi làm lỗi biến mất, sau đó lỗi quay lại.', steps: [
          { ev: 'recheck()', set: { stillThere: false }, say: 'Scene bị viết lại, lỗi không còn nên finding Open chuyển Stale.' },
          { ev: 'redetected()', set: { stillThere: true }, say: 'Một lần sửa sau làm lỗi xuất hiện lại, finding mở lại.' },
        ] },
      ],
    },
    feedback: {
      name: 'PreviewFeedback', vi: 'Phản hồi xem thử', file: 'Preview/PreviewFeedback.cs', initial: 'New', initEvent: 'send()',
      states: {
        New: {
          vi: 'Mới',
          act: 'entry / notify Producer',
          desc: 'Phản hồi mới được gửi từ người xem thử ngoài studio thông qua liên kết bảo mật (PreviewLink có token, watermark, thời hạn). Chưa qua xử lý.',
          col: 0, row: 0
        },
        Noted: {
          vi: 'Ghi nhận',
          act: 'entry / để bản sau',
          desc: 'Producer/Editor đã đọc và ghi nhận ý kiến đóng góp mang tính tham khảo lâu dài hoặc dành cho các tập tiếp theo, không yêu cầu sửa chương hiện tại.',
          col: 1, row: 0
        },
        NeedsChange: {
          vi: 'Cần sửa',
          act: 'entry / lưu ghi chú',
          desc: 'Producer/Editor đánh giá lỗi này nghiêm trọng và cần sửa ngay trước khi xuất bản (bắt buộc ghi chú làm căn cứ mở lại chương và tạo ChangeRequest).',
          col: 1, row: 1
        },
        Linked: {
          vi: 'Đã thành CR',
          act: 'entry / khoá phân loại',
          desc: 'Phản hồi đã chính thức chuyển hóa thành ChangeRequest trong studio sau khi Producer mở lại chương (Reopen). Khóa phân loại không thể sửa đổi.',
          col: 2, row: 1, final: 'good'
        },
      },
      inputs: [
        { id: 'note', label: 'Ghi chú', type: 'text', value: '' },
        { id: 'reopened', label: 'Chương đã được mở lại (InProduction)', type: 'check', value: false }
      ],
      vars: { changeRequestId: null },
      t: [
        { from: 'New', to: 'Noted', ev: 'triage(Noted)', who: 'Producer / Editor', btn: 'Ghi nhận', src: 'TriagePreviewFeedbackCommand',
          explain: 'Producer/Editor ghi nhận ý kiến đóng góp để tham khảo cho các tập sau, không yêu cầu sửa chương này.' },
        { from: 'New', to: 'NeedsChange', ev: 'triage(NeedsChange)', who: 'Producer / Editor', btn: 'Cần sửa', src: 'TriagePreviewFeedbackCommand',
          explain: 'Producer/Editor đánh giá lỗi nghiêm trọng cần sửa trước khi phát hành (bắt buộc ghi chú làm căn cứ sửa).',
          g: ['note != ""', G([filled('note'), 'Cần sửa bắt buộc ghi chú (sẽ dùng làm lý do mở lại chương).'])] },
        { from: 'Noted', to: 'NeedsChange', ev: 'triage(NeedsChange)', who: 'Producer / Editor', btn: 'Đổi thành cần sửa', src: 'TriagePreviewFeedbackCommand',
          explain: 'Đổi phân loại từ ghi nhận sang cần sửa khi xem xét kỹ lại mức độ ảnh hưởng của phản hồi.',
          g: ['note != ""', G([filled('note'), 'Cần sửa bắt buộc ghi chú (sẽ dùng làm lý do mở lại chương).'])] },
        { from: 'NeedsChange', to: 'Noted', ev: 'triage(Noted)', who: 'Producer / Editor', btn: 'Đổi thành ghi nhận', src: 'TriagePreviewFeedbackCommand',
          explain: 'Đổi phân loại từ cần sửa sang ghi nhận sau khi thống nhất không cần sửa đổi trong bản này.' },
        { from: 'NeedsChange', to: 'Linked', ev: 'createChangeRequest()', who: 'Producer / Editor', btn: 'Tạo ChangeRequest', src: 'CreateChangeRequestFromFeedbackCommand',
          explain: 'Chuyển hóa phản hồi thành ChangeRequest giao cho Artist/Writer. Đòi hỏi Producer phải Reopen Chapter về InProduction trước (thu hồi link xem thử). Việc liên quan nếu đã Approved sẽ bị kéo về ReworkRequired.',
          g: ['chapter.Status == InProduction', G([c => c.reopened, 'Chương chưa được mở lại: Producer phải mở lại chương trước.'])],
          a: ['tạo ChangeRequest; việc Approved → ReworkRequired', c => c.changeRequestId = 'CR-' + Math.floor(Math.random() * 900 + 100)] },
      ],
      notes: [
        'BR-09, BR-17: link xem thử có hạn, gắn người nhận, có watermark, thu hồi được và ghi log truy cập.',
        'NeedsChange không tự mở lại chương: Producer mở lại bằng reopen (lý do lấy từ ghi chú), khi đó mọi link bị thu hồi.',
        '\"Đã thành CR\" là cách vẽ cho lúc phản hồi đã gắn ChangeRequestId; trong enum C# trạng thái lưu vẫn là NeedsChange kèm khóa không phân loại lại.'
      ],
      flows: [
        { name: 'Phản hồi thành yêu cầu sửa', desc: 'Từ người xem ngoài tới việc làm lại trong studio.', steps: [
          { ev: 'triage(NeedsChange)', set: { note: '' }, say: 'Producer chọn "cần sửa" mà không ghi chú: bị chặn.' },
          { ev: 'triage(NeedsChange)', set: { note: 'Khách thấy trang 7 thiếu thoại' }, say: 'Có ghi chú thì phản hồi chuyển NeedsChange.' },
          { ev: 'createChangeRequest()', say: 'Chương vẫn đang Approved nên chưa tạo CR được.' },
          { ev: 'createChangeRequest()', set: { reopened: true }, say: 'Producer mở lại chương (chương về InProduction, link bị thu hồi), rồi tạo CR. Việc liên quan về ReworkRequired.' },
        ] },
        { name: 'Chỉ ghi nhận', desc: 'Góp ý để dành cho bản sau.', steps: [{ ev: 'triage(Noted)', say: 'Producer ghi nhận, không mở lại chương.' }] },
      ],
    },
    airun: {
      name: 'AiWorkflowRun', vi: 'Lượt chạy AI', file: 'Ai/AiWorkflowRun.cs', initial: 'Queued', initEvent: 'runWorkflow()',
      states: {
        Queued: {
          vi: 'Xếp hàng',
          act: 'do / chờ worker',
          desc: 'Lượt chạy AI vừa được người dùng kích hoạt, đang nằm trong hàng đợi chờ tiến trình nền (background worker) nhận xử lý.',
          col: 0, row: 0
        },
        Running: {
          vi: 'Đang chạy',
          act: 'do / chuỗi tác tử AI',
          desc: 'Tiến trình AI đang thực thi chuỗi tác tử đa tầng (Writer -> Storyboard -> Continuity -> Lettering). Cập nhật liên tục LastActivityAtUtc.',
          col: 1, row: 0
        },
        Completed: {
          vi: 'Hoàn tất',
          act: 'entry / đề xuất chờ duyệt',
          desc: 'Chuỗi tác tử hoàn tất thành công mọi bước và không còn lỗi nhất quán mức Blocking. Các đề xuất (AiSuggestion) đã sẵn sàng để người dùng xem xét.',
          col: 2, row: 0, final: 'good'
        },
        WaitingForHuman: {
          vi: 'Chờ người',
          act: 'entry / dừng pipeline',
          desc: 'Vòng lặp tự động sửa giữa Writer và Continuity đã chạm mốc tối đa (MaxRevisionRounds) nhưng vẫn còn lỗi Blocking. Pipeline dừng lại để con người can thiệp.',
          col: 2, row: 1
        },
        Failed: {
          vi: 'Lỗi',
          act: 'entry / lưu ErrorCode',
          desc: 'Tiến trình AI gặp lỗi kỹ thuật (hết quota, timeout, lỗi API LLM). Hệ thống lưu ErrorCode/ErrorMessage. Người dùng vẫn tiếp tục làm việc thủ công bình thường (NFR).',
          col: 1, row: 1, final: 'bad'
        },
        Interrupted: {
          vi: 'Bị ngắt',
          act: 'entry / AI_INTERRUPTED',
          desc: 'Tiến trình AI bị mất kết nối quá thời gian chờ (heartbeat timeout) hoặc server khởi động lại giữa chừng. Chưa hỗ trợ resume, cần chạy lại.',
          col: 2, row: 2, final: 'bad'
        },
      },
      inputs: [
        { id: 'blocking', label: 'Sau số vòng sửa tối đa vẫn còn finding chặn', type: 'check', value: false },
        { id: 'timedOut', label: 'AI service mất tín hiệu quá thời hạn (staleAfter)', type: 'check', value: false },
        { id: 'failed', label: 'Lỗi gọi mô hình / hết quota', type: 'check', value: false },
      ],
      vars: { errorCode: null, writerRound: 0 },
      t: [
        { from: 'Queued', to: 'Running', ev: 'touch()', who: 'AI service (bước đầu tiên)', btn: 'Bắt đầu chạy', src: 'RecordAgentStepCommand',
          explain: 'Tiến trình nền nhận tác vụ và bắt đầu bước đầu tiên trong chuỗi đa tác tử (Writer -> Storyboard -> Continuity -> Lettering).',
          a: ['ghi LastActivityAt', c => c.writerRound++] },
        { from: 'Running', to: 'Completed', ev: 'markCompleted()', who: 'Hệ thống', btn: 'Chạy xong', src: 'RecordAgentStepCommand',
          explain: 'Chuỗi tác tử hoàn tất thành công và không còn lỗi nhất quán mức Blocking. Các đề xuất (AiSuggestion) sẵn sàng chờ duyệt.',
          g: ['!blockingFinding', G([c => !c.blocking, 'Còn finding chặn: workflow phải dừng chờ người.'])] },
        { from: 'Running', to: 'WaitingForHuman', ev: 'markWaitingForHuman()', who: 'Hệ thống', btn: 'Dừng chờ người', src: 'RecordAgentStepCommand',
          explain: 'Quá trình tự sửa vòng lặp vượt quá số vòng tối đa (MaxRevisionRounds) mà vẫn còn lỗi chặn. Tác vụ dừng lại để con người can thiệp.',
          g: ['blockingFinding sau max vòng', G([c => c.blocking, 'Không có finding chặn: workflow phải chuyển Completed.'])] },
        { from: 'Running', to: 'Failed', ev: 'markFailed(code)', who: 'Hệ thống', btn: 'Báo lỗi', src: 'RecordAgentStepCommand',
          explain: 'Gặp lỗi kỹ thuật (API LLM lỗi, hết quota). Hệ thống lưu mã lỗi. Writer vẫn tiếp tục viết tay bình thường (NFR).',
          a: ['lưu ErrorCode', c => c.errorCode = 'PROVIDER_ERROR'] },
        { from: 'Queued', to: 'Failed', ev: 'markFailed(code)', who: 'Hệ thống', btn: 'Lỗi lúc chờ', src: 'RecordAgentStepCommand',
          explain: 'Gặp lỗi khi đang trong hàng đợi (không khởi tạo được context snapshot).',
          a: ['lưu ErrorCode', c => c.errorCode = 'QUEUE_TIMEOUT'] },
        { from: 'Running', to: 'Interrupted', ev: 'markInterrupted()', who: 'Cron job kiểm tra', btn: 'Phát hiện ngắt', src: 'MarkStaleRunsCommand',
          explain: 'Tiến trình bị mất kết nối quá thời gian chờ (heartbeat timeout) hoặc server khởi động lại. Cần chạy lại tác vụ mới.',
          g: ['lastActivity < now − staleAfter', G([c => c.timedOut, 'Service vẫn đang hoạt động bình thường.'])],
          a: ['lưu AI_INTERRUPTED', c => c.errorCode = 'AI_INTERRUPTED'] },
        { from: 'Queued', to: 'Interrupted', ev: 'markInterrupted()', who: 'Cron job kiểm tra', btn: 'Ngắt trong hàng đợi', src: 'MarkStaleRunsCommand',
          explain: 'Tác vụ nằm trong hàng đợi quá lâu mà không có worker nào nhận xử lý.',
          g: ['lastActivity < now − staleAfter', G([c => c.timedOut, 'Service vẫn đang hoạt động bình thường.'])],
          a: ['lưu AI_INTERRUPTED', c => c.errorCode = 'AI_INTERRUPTED'] },
      ],
      notes: [
        'Phiếu V1.2: agent không bao giờ tự ý đổi stage hay duyệt cổng, mọi output đều là đề xuất (AiSuggestion).',
        'NFR tính sẵn sàng: AI hỏng, tắt hoặc hết quota thì mọi luồng thủ công trong studio vẫn hoạt động bình thường.',
        'Chưa hỗ trợ resume: run bị ngắt (Interrupted) phải chạy lại từ đầu.',
        'Composite state: chuỗi FullScene gồm Writer → Continuity → Storyboard → Editor. Hết số vòng sửa mà vẫn còn lỗi chặn thì dừng ở WaitingForHuman.'
      ],
      flows: [
        { name: 'Chuỗi chạy êm xuôi', desc: 'AI chạy xong, không còn lỗi chặn, đề xuất sẵn sàng.', steps: [
          { ev: 'touch()', say: 'AI worker nhận run, chuyển Running và cập nhật LastActivityAtUtc.' },
          { ev: 'markCompleted()', say: 'Không còn lỗi chặn, run chuyển Completed. Các đề xuất chuyển sang chờ Writer duyệt.' },
        ] },
        { name: 'Kẹt vì lỗi nhất quán', desc: 'Hết số vòng sửa mà Continuity vẫn báo lỗi chặn.', steps: [
          { ev: 'touch()', say: 'Run bắt đầu.' },
          { ev: 'markCompleted()', set: { blocking: true }, say: 'Continuity vẫn thấy lỗi chặn sau số vòng tối đa nên không được hoàn tất.' },
          { ev: 'markWaitingForHuman()', say: 'Run dừng ở WaitingForHuman, Storyboard/Editor không chạy, người dùng xử lý tiếp.' },
        ] },
        { name: 'AI hỏng', desc: 'Provider lỗi, luồng thủ công vẫn dùng được.', steps: [
          { ev: 'touch()', say: 'Run bắt đầu.' },
          { ev: 'markFailed(code)', say: 'Provider báo hết quota, run chuyển Failed. Writer vẫn viết tay bình thường.' },
        ] },
      ],
    },
    aisug: {
      name: 'AiSuggestion', vi: 'Đề xuất của AI', file: 'Ai/AiSuggestion.cs', initial: 'Pending', initEvent: 'create()',
      states: {
        Pending: {
          vi: 'Chờ quyết định',
          act: 'do / người xem xét',
          desc: 'Đề xuất do AI sinh ra (kịch bản Script, bố cục Layout, mô tả ImagePrompt, rút gọn thoại Lettering) đang chờ con người có thẩm quyền quyết định (BR-02).',
          col: 0, row: 1
        },
        Accepted: {
          vi: 'Chấp nhận',
          act: 'entry / ghi ContentRevision',
          desc: 'Đề xuất được chấp thuận: hệ thống tạo một ContentRevision mới (append-only, lưu hash SHA-256 và truy vết nguồn gốc Provenance theo BR-01, BR-10, BR-18). Bản cũ vẫn được giữ nguyên.',
          col: 1, row: 0, final: 'good'
        },
        Rejected: {
          vi: 'Từ chối',
          act: 'entry / ghi Decision',
          desc: 'Người dùng từ chối đề xuất của AI. Bản ghi quyết định (Decision) được lưu lại để phục vụ kiểm toán và không làm ảnh hưởng nội dung hiện tại.',
          col: 1, row: 1, final: 'bad'
        },
        ChangesRequested: {
          vi: 'Yêu cầu làm lại',
          act: 'entry / ghi Decision',
          desc: 'Người dùng không ưng ý và yêu cầu AI chạy lại hoặc điều chỉnh theo chỉ dẫn mới. Ghi nhận Decision và kích hoạt lượt chạy tiếp theo.',
          col: 1, row: 2, final: 'bad'
        },
      },
      inputs: [
        { id: 'roleOk', label: 'Người quyết định có vai trò phù hợp với loại đề xuất', type: 'check', value: true },
        { id: 'inProd', label: 'Chương đang InProduction (BR-12)', type: 'check', value: true },
        { id: 'noBlock', label: 'Đề xuất không còn finding chặn', type: 'check', value: true },
        { id: 'versionOk', label: 'Version không đổi kể từ lúc AI đọc (BR-11)', type: 'check', value: true },
      ],
      vars: { revisions: 0, decisions: 0 },
      t: [
        { from: 'Pending', to: 'Accepted', ev: 'decide(Accepted)', who: 'Writer / Artist / Letterer / Editor theo loại', btn: 'Chấp nhận', src: 'ReviewSuggestionCommand',
          explain: 'Người dùng có thẩm quyền chấp thuận đề xuất. Hệ thống tạo một ContentRevision mới (append-only, lưu mã băm SHA-256 và truy vết Provenance theo BR-01, BR-10, BR-18). Kiểm tra version tránh ghi đè đồng thời (BR-11).',
          g: ['role ok && chapter InProduction && !blockingFinding && version khớp', G(
            [c => c.roleOk, 'Vai trò này không được quyết định loại đề xuất này.'],
            [c => c.inProd, 'Chapter đang chỉ đọc, không áp dụng được đề xuất (BR-12).'],
            [c => c.noBlock, 'Đề xuất còn finding chặn từ Continuity: chỉ được Reject hoặc RequestChanges.'],
            [c => c.versionOk, 'Nội dung đã đổi kể từ lúc AI đọc (409 Conflict, BR-11).'])],
          a: ['ghi ContentRevision + Decision (BR-01, BR-10)', c => { c.revisions++; c.decisions++; }] },
        { from: 'Pending', to: 'Rejected', ev: 'decide(Rejected)', who: 'Người có vai trò phù hợp', btn: 'Từ chối', src: 'ReviewSuggestionCommand',
          explain: 'Người dùng từ chối đề xuất của AI. Bản ghi quyết định (Decision) được lưu lại phục vụ kiểm toán mà không làm thay đổi nội dung hiện tại.',
          g: ['role ok', G([c => c.roleOk, 'Vai trò này không được quyết định loại đề xuất này.'])], a: ['ghi Decision', c => c.decisions++] },
        { from: 'Pending', to: 'ChangesRequested', ev: 'decide(ChangesRequested)', who: 'Người có vai trò phù hợp', btn: 'Yêu cầu làm lại', src: 'ReviewSuggestionCommand',
          explain: 'Người dùng yêu cầu AI làm lại hoặc điều chỉnh theo hướng dẫn mới. Ghi nhận Decision và kích hoạt lượt chạy tiếp theo.',
          g: ['role ok', G([c => c.roleOk, 'Vai trò này không được quyết định loại đề xuất này.'])], a: ['ghi Decision; chạy lại agent', c => c.decisions++] },
      ],
      notes: [
        'BR-02: AI chỉ đề xuất, con người toàn quyền quyết định.',
        'BR-10: phải có xuất xứ (provenance) trước khi trở thành nội dung chính thức.',
        'BR-11: Optimistic concurrency – từ chối áp dụng nếu phiên bản nội dung đã bị người khác sửa đổi kể từ lúc AI đọc (tránh xung đột 409).',
        'Phiếu V1.2: chuỗi truy vết run → agent step → suggestion → human decision → content revision.',
        'Chấp thuận đề xuất (Accept) tạo bản ContentRevision mới, không tự ý đổi stage và không duyệt Chapter.'
      ],
      flows: [
        { name: 'Chấp nhận đề xuất', desc: 'Áp dụng = tạo revision mới, bản cũ vẫn còn.', steps: [{ ev: 'decide(Accepted)', say: 'Writer chấp nhận thoại AI viết. Hệ thống ghi Decision và ContentRevision mới trong một transaction (BR-01, BR-10, BR-18).' }] },
        { name: 'Bị chặn khi áp dụng', desc: 'Các guard bảo vệ nội dung.', steps: [
          { ev: 'decide(Accepted)', set: { noBlock: false }, say: 'Continuity còn báo lỗi chặn trên đề xuất này nên không chấp nhận được.' },
          { ev: 'decide(Accepted)', set: { noBlock: true, versionOk: false }, say: 'Một người khác vừa sửa scene, version lệch nên bị trả 409 (BR-11).' },
          { ev: 'decide(ChangesRequested)', set: { versionOk: true }, say: 'Writer yêu cầu AI làm lại trên bản mới nhất.' },
        ] },
      ],
    },
    export: {
      name: 'ExportJob', vi: 'Xuất file', file: 'Publishing/ExportJob.cs', initial: 'Queued', initEvent: 'requestExport()',
      states: {
        Queued: {
          vi: 'Xếp hàng',
          act: 'do / chờ worker',
          desc: 'Yêu cầu xuất file đóng gói (PDF, CBZ, WebP/PNG, JSON) đang chờ worker nền xử lý. Producer có thể hủy yêu cầu ở trạng thái này.',
          col: 0, row: 0
        },
        Processing: {
          vi: 'Đang xử lý',
          act: 'do / render file',
          desc: 'Worker đang tổng hợp dữ liệu các trang, vẽ lại canvas độ phân giải cao và nén thành tệp xuất bản. Không được hủy giữa chừng (409 Conflict).',
          col: 1, row: 0
        },
        Completed: {
          vi: 'Hoàn tất',
          act: 'entry / lưu StorageKey',
          desc: 'File đã được kết xuất thành công, tải lên bộ nhớ an toàn (StorageKey), tính toán dung lượng và mã băm toàn vẹn SHA-256 (BR-04).',
          col: 2, row: 0, final: 'good'
        },
        Cancelled: {
          vi: 'Đã huỷ',
          act: 'entry / dừng job',
          desc: 'Yêu cầu xuất file đã bị Producer hủy trước khi worker bắt đầu xử lý.',
          col: 0, row: 1, final: 'bad'
        },
        Failed: {
          vi: 'Lỗi',
          act: 'entry / lưu Error',
          desc: 'Quá trình kết xuất thất bại (do lỗi bộ nhớ, timeout hoặc lỗi render). Lưu vết lỗi để Producer xem và yêu cầu xuất lại.',
          col: 2, row: 1, final: 'bad'
        },
      },
      inputs: [{ id: 'member', label: 'Người tải là thành viên Workspace', type: 'check', value: true }],
      vars: { storageKey: null, error: null, downloads: 0 },
      t: [
        { from: 'Queued', to: 'Processing', ev: 'start()', who: 'Worker nền', btn: 'Worker nhận job', src: 'ExportJob.Start',
          explain: 'Tiến trình nền nhận tác vụ từ hàng đợi và bắt đầu render các trang, nén file PDF/CBZ/JSON.' },
        { from: 'Queued', to: 'Cancelled', ev: 'cancel()', who: 'Producer', btn: 'Huỷ', src: 'CancelExportJobCommand',
          explain: 'Producer hủy yêu cầu xuất file khi còn đang chờ trong hàng đợi. Không được hủy khi đang Processing (409 Conflict).' },
        { from: 'Processing', to: 'Completed', ev: 'complete(file)', who: 'Worker nền', btn: 'Xuất xong', src: 'ExportJob.Complete',
          explain: 'Render thành công, file được lưu vào kho lưu trữ an toàn (StorageKey), tính toán dung lượng và mã hash SHA-256 (BR-04).',
          a: ['lưu file + SHA-256', c => c.storageKey = 'exports/ch01.pdf'] },
        { from: 'Processing', to: 'Failed', ev: 'fail(error)', who: 'Worker nền', btn: 'Xuất lỗi', src: 'ExportJob.Fail',
          explain: 'Quá trình render thất bại (lỗi bộ nhớ, timeout), lưu vết lỗi để Producer thử lại bằng tác vụ mới.',
          a: ['lưu Error', c => c.error = 'Render timeout'] },
        { from: 'Completed', to: 'Completed', ev: 'recordDownload()', who: 'Thành viên Workspace', btn: 'Tải file', src: 'DownloadExportCommand',
          explain: 'Thành viên Workspace tải file qua API kiểm quyền (BR-16). Mỗi lần tải được tăng biến đếm DownloadCount và ghi log kiểm toán (Audit Log), không lộ đường dẫn trực tiếp tới kho.',
          g: ['là thành viên Workspace (BR-16)', G([c => c.member, 'Không có quyền truy cập Workspace này.'])], a: ['downloads++; ghi audit', c => c.downloads++] },
      ],
      notes: [
        'Phiếu V1.2: hỗ trợ xuất page images (WebP/PNG), PDF, CBZ (truyện tranh đóng gói) và JSON metadata.',
        'BR-04: tính mã băm toàn vẹn SHA-256 trên đúng file kết xuất.',
        'BR-16: tải file qua API trung gian có kiểm soát quyền, không bao giờ lộ trực tiếp đường dẫn kho lưu trữ (S3/MinIO bucket).',
        'Chỉ huỷ được khi còn ở Queued; job đang ở trạng thái Processing không được huỷ giữa chừng (trả về 409 Conflict).'
      ],
      flows: [
        { name: 'Xuất và tải', desc: 'Từ lúc yêu cầu xuất tới lúc tải file.', steps: [
          { ev: 'start()', say: 'Worker nhận job, chuyển Processing.' },
          { ev: 'complete(file)', say: 'Render xong, file được lưu kèm hash.' },
          { ev: 'recordDownload()', say: 'Producer tải file, lượt tải được đếm và ghi audit.' },
          { ev: 'recordDownload()', set: { member: false }, say: 'Người ngoài Workspace thử tải: bị chặn (BR-16).' },
        ] },
        { name: 'Huỷ khi đang chạy', desc: 'Chỉ huỷ được lúc còn Queued.', steps: [
          { ev: 'start()', say: 'Worker đã nhận job.' },
          { ev: 'cancel()', say: 'Producer bấm huỷ khi job đang chạy: không có transition từ Processing (409).' },
        ] },
      ],
    },
  };

  // ---------- SVG renderer ----------
  const BW = 184, BH = 78, CW = 300, RH = 150, PADX = 74, PADY = 56;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const center = s => ({ x: PADX + s.col * CW + BW / 2, y: PADY + s.row * RH + BH / 2 });
  function clip(c, p) {
    const dx = p.x - c.x, dy = p.y - c.y;
    const s = Math.min(Math.abs((BW / 2 + 4) / (dx || 1e-9)), Math.abs((BH / 2 + 4) / (dy || 1e-9)));
    return { x: c.x + dx * s, y: c.y + dy * s };
  }
  const textW = s => s.length * 6.9 + 16;

  function render(svg, m, uid) {
    svg.innerHTML = '';
    const states = Object.entries(m.states);
    const maxC = Math.max(...states.map(([, s]) => s.col)), maxR = Math.max(...states.map(([, s]) => s.row));
    const W = PADX + maxC * CW + BW + 70, H = PADY + maxR * RH + BH + 30;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.maxWidth = W + 'px';

    const defs = el('defs', {}, svg);
    [['n', 'var(--on-surface)', 1.3], ['a', 'var(--primary)', 1.8], ['e', 'var(--error)', 1.8]].forEach(([k, col, w]) => {
      const mk = el('marker', { id: `car-${k}-${uid}`, viewBox: '0 0 10 10', refX: 7.5, refY: 5, markerUnits: 'userSpaceOnUse', markerWidth: 10, markerHeight: 10, orient: 'auto' }, defs);
      el('path', { d: 'M 3 1.2 L 7.5 5 L 3 8.8', fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mk);
    });
    const edges = el('g', {}, svg), nodes = el('g', {}, svg), pills = el('g', {}, svg);
    const ref = { edges: {}, nodes: {}, uid };

    const drawEdge = (d, idx, label, lx, ly) => {
      ref.edges[idx] = el('path', { d, fill: 'none', stroke: 'var(--on-surface)', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-dasharray': '0 4', 'marker-end': `url(#car-n-${uid})`, class: 'transition-edge' }, edges);
      if (label) {
        const w = textW(label);
        el('rect', { x: lx - w / 2, y: ly - 10, width: w, height: 20, rx: 10, fill: 'var(--surface)' }, pills);
        el('text', { x: lx, y: ly + 4, class: 'edge-label', 'text-anchor': 'middle' }, pills).textContent = label;
      }
    };

    if (m.initial) {
      const ic = center(m.states[m.initial]);
      const ip = { x: ic.x - BW / 2 - 52, y: ic.y };
      el('circle', { cx: ip.x, cy: ip.y, r: 9, fill: 'var(--on-surface)' }, nodes);
      drawEdge(`M ${ip.x + 11} ${ip.y} L ${ic.x - BW / 2 - 4} ${ic.y}`, 'init');
    }

    m.t.forEach((t, i) => {
      const a = center(m.states[t.from]), b = center(m.states[t.to]);
      if (t.from === t.to) {
        const x0 = a.x + 24, y0 = a.y - BH / 2 - 4, x1 = a.x + BW / 2 + 4;
        drawEdge(`M ${x0} ${y0} C ${x0} ${y0 - 44}, ${x1 + 40} ${a.y - 40}, ${x1} ${a.y - 12}`, i, t.ev, x0 + 50, y0 - 32);
        return;
      }
      const rev = m.t.some(o => o.from === t.to && o.to === t.from);
      const bend = t.bend ?? (rev ? 26 : 0);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;
      const c = { x: (a.x + b.x) / 2 + nx * bend * 2, y: (a.y + b.y) / 2 + ny * bend * 2 };
      const p1 = clip(a, bend ? c : b), p2 = clip(b, bend ? c : a);
      const mid = { x: 0.25 * p1.x + 0.5 * c.x + 0.25 * p2.x, y: 0.25 * p1.y + 0.5 * c.y + 0.25 * p2.y };
      if (rev) {
        const push = Math.abs(nx) * (textW(t.ev) / 2 - 20) + Math.abs(ny) * 4;
        mid.x += nx * Math.sign(bend) * push; mid.y += ny * Math.sign(bend) * push;
      }
      if (t.lo) { mid.x += t.lo[0]; mid.y += t.lo[1]; }
      drawEdge(`M ${p1.x} ${p1.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`, i, t.ev, mid.x, mid.y);
    });

    states.forEach(([key, s]) => {
      const x = PADX + s.col * CW, y = PADY + s.row * RH;
      const g = el('g', { class: 'state-node' + (s.final ? ' is-final' : ''), 'data-state': key }, nodes);
      el('rect', { class: 'state-rect', x, y, width: BW, height: BH, rx: 16,
        fill: s.final === 'good' ? 'var(--accent-container)' : s.final === 'bad' ? 'var(--surface-dim)' : 'var(--surface-container)',
        stroke: s.final === 'good' ? 'var(--primary)' : 'var(--outline)' }, g);
      let tx = x + BW / 2;
      if (s.final) {
        const col = s.final === 'good' ? 'var(--primary)' : 'var(--error)';
        el('circle', { cx: x + 18, cy: y + 21, r: 8, fill: 'none', stroke: col, 'stroke-width': 1.8 }, g);
        el('circle', { cx: x + 18, cy: y + 21, r: 4, fill: col }, g);
        tx += 8;
      }
      el('text', { x: tx, y: y + 26, class: 'st-name', 'text-anchor': 'middle' }, g).textContent = s.vi;
      el('line', { x1: x + 10, y1: y + 36, x2: x + BW - 10, y2: y + 36, stroke: 'var(--stroke-default)', 'stroke-width': 1 }, g);
      el('text', { x: x + BW / 2, y: y + 53, class: 'st-act', 'text-anchor': 'middle' }, g).textContent = s.act;
      el('text', { x: x + BW / 2, y: y + 69, class: 'st-key', 'text-anchor': 'middle' }, g).textContent = key;
      ref.nodes[key] = g;
    });
    ref.particle = el('circle', { r: 5, class: 'flow-particle' }, svg);
    return ref;
  }

  const findT = (m, state, ev) => {
    let i = m.t.findIndex(t => t.ev === ev && t.from === state);
    if (i < 0) i = m.t.findIndex(t => t.ev === ev);
    return i;
  };
  const checkGuard = (t, ctx) => (t.g ? t.g[1](ctx) : true);
  const freshCtx = m => { const c = JSON.parse(JSON.stringify(m.vars)); m.inputs.forEach(i => c[i.id] = i.value); return c; };
  const runFlow = (m, flow) => {
    let state = m.initial; const ctx = freshCtx(m);
    return flow.steps.map(s => {
      Object.assign(ctx, s.set || {});
      const t = m.t[findT(m, state, s.ev)];
      if (!t || t.from !== state) return { ok: false, why: `Không có transition ${s.ev} từ ${state}.`, t };
      const g = checkGuard(t, ctx);
      if (g !== true) return { ok: false, why: g, t };
      t.a && t.a[1](ctx); state = t.to;
      return { ok: true, to: state, t };
    });
  };

  window.SM = { MACHINES, render, now, findT, checkGuard, freshCtx, runFlow };
})();
