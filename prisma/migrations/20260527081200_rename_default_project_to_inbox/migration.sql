-- 把默认项目从「杂事」改名为「收集箱」。
-- 仅在用户没手动改过名（仍叫「杂事」）时才更新，
-- 这样用户已经自定义过名字（例如「Inbox」「日常」）不会被覆盖。
UPDATE "Project"
SET "name" = '收集箱'
WHERE "id" = 'default-misc' AND "name" = '杂事';
