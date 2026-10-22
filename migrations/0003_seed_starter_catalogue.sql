-- Exam Cracker starter learning catalogue.
-- Idempotent seed: keeps existing admin-edited rows untouched.
-- These are empty course containers; no lectures/videos are fabricated.
INSERT OR IGNORE INTO course_catalog
  (id, kind, title, description, exam, classes, active, access_code, metadata, created_at, updated_at, parent_id, subject_id, sort_order)
VALUES
  ('ec-batch-jee-11-foundation', 'batch', 'JEE Class 11 Foundation Batch', 'Class 11 Physics, Chemistry and Mathematics foundation for JEE Main and Advanced. Lecture slots are ready for your uploads.', 'JEE', '["11"]', 1, NULL, '{"thumbnailUrl":"https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=85","badge":"CLASS 11","courseType":"Foundation Batch","language":"Hindi + English","level":"Foundation","lectureUploadPending":true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL, 10),
  ('ec-batch-jee-12-target', 'batch', 'JEE Class 12 Target Batch', 'Class 12 JEE preparation with Physics, Chemistry and Mathematics. Add your chapter-wise lectures whenever ready.', 'JEE', '["12"]', 1, NULL, '{"thumbnailUrl":"https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=85","badge":"CLASS 12","courseType":"Target Batch","language":"Hindi + English","level":"Target","lectureUploadPending":true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL, 20),
  ('ec-batch-neet-11-foundation', 'batch', 'NEET Class 11 Foundation Batch', 'Class 11 NEET foundation with Physics, Chemistry and Biology. Course is ready for lecture uploads.', 'NEET', '["11"]', 1, NULL, '{"thumbnailUrl":"https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=85","badge":"CLASS 11","courseType":"Foundation Batch","language":"Hindi + English","level":"Foundation","lectureUploadPending":true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL, 30),
  ('ec-batch-neet-12-target', 'batch', 'NEET Class 12 Target Batch', 'Class 12 NEET preparation with Physics, Chemistry and Biology. Add lessons and resources later from the admin panel.', 'NEET', '["12"]', 1, NULL, '{"thumbnailUrl":"https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85","badge":"CLASS 12","courseType":"Target Batch","language":"Hindi + English","level":"Target","lectureUploadPending":true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL, 40),
  ('ec-series-jee-11-subjectwise', 'series', 'JEE 11th Subject-wise Series', 'Subject-wise JEE Class 11 series. Physics, Chemistry and Mathematics sections are prepared for your future lectures.', 'JEE', '["11"]', 1, NULL, '{"thumbnailUrl":"https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=85","badge":"JEE SERIES","courseType":"Subject-wise Series","language":"Hindi + English","level":"Foundation","lectureUploadPending":true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL, 50),
  ('ec-series-jee-12-revision', 'series', 'JEE 12th Revision Series', 'A dedicated Class 12 JEE revision series, ready for chapter-wise videos, notes and practice resources.', 'JEE', '["12"]', 1, NULL, '{"thumbnailUrl":"https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=85","badge":"JEE SERIES","courseType":"Revision Series","language":"Hindi + English","level":"Revision","lectureUploadPending":true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL, 60),
  ('ec-series-neet-11-biology', 'series', 'NEET 11th Biology & Core Series', 'NEET Class 11 series with Biology, Physics and Chemistry sections ready for lesson uploads.', 'NEET', '["11"]', 1, NULL, '{"thumbnailUrl":"https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=85","badge":"NEET SERIES","courseType":"Subject-wise Series","language":"Hindi + English","level":"Foundation","lectureUploadPending":true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL, 70),
  ('ec-series-neet-12-revision', 'series', 'NEET 12th Revision Series', 'Class 12 NEET revision series with Biology, Physics and Chemistry sections ready for videos and notes.', 'NEET', '["12"]', 1, NULL, '{"thumbnailUrl":"https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85","badge":"NEET SERIES","courseType":"Revision Series","language":"Hindi + English","level":"Revision","lectureUploadPending":true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL, 80);

INSERT OR IGNORE INTO subjects (id, name, description, exam, classes, active, archived, sort_order)
VALUES
  ('ec-subject-jee-physics', 'Physics', 'JEE Physics lessons and study resources.', 'JEE', '["11","12"]', 1, 0, 10),
  ('ec-subject-jee-chemistry', 'Chemistry', 'JEE Chemistry lessons and study resources.', 'JEE', '["11","12"]', 1, 0, 20),
  ('ec-subject-jee-mathematics', 'Mathematics', 'JEE Mathematics lessons and study resources.', 'JEE', '["11","12"]', 1, 0, 30),
  ('ec-subject-neet-physics', 'Physics', 'NEET Physics lessons and study resources.', 'NEET', '["11","12"]', 1, 0, 10),
  ('ec-subject-neet-chemistry', 'Chemistry', 'NEET Chemistry lessons and study resources.', 'NEET', '["11","12"]', 1, 0, 20),
  ('ec-subject-neet-biology', 'Biology', 'NEET Biology lessons and study resources.', 'NEET', '["11","12"]', 1, 0, 30);

INSERT OR IGNORE INTO course_subjects (course_id, subject_id, sort_order)
SELECT c.id, s.id, s.sort_order
FROM course_catalog c
JOIN subjects s ON (
  (c.exam = 'JEE' AND s.id IN ('ec-subject-jee-physics','ec-subject-jee-chemistry','ec-subject-jee-mathematics'))
  OR
  (c.exam = 'NEET' AND s.id IN ('ec-subject-neet-physics','ec-subject-neet-chemistry','ec-subject-neet-biology'))
)
WHERE c.id IN (
  'ec-batch-jee-11-foundation','ec-batch-jee-12-target',
  'ec-batch-neet-11-foundation','ec-batch-neet-12-target',
  'ec-series-jee-11-subjectwise','ec-series-jee-12-revision',
  'ec-series-neet-11-biology','ec-series-neet-12-revision'
);
