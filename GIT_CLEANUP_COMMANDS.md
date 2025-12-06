# Git 清理命令

这些命令用于从 Git 暂存区（Cache）中删除已提交的媒体文件和上传目录内容，但保留本地文件。

## ⚠️ 重要提示

在执行这些命令之前，请确保：
1. 你已经提交了 `.gitignore` 的更改
2. 你已经创建了所有必要的 `.gitkeep` 文件
3. 你已经备份了重要的文件（虽然文件会保留在本地）

## 📋 清理步骤

### 步骤 1: 删除 public/uploads/ 目录下的所有文件（保留 .gitkeep）

```bash
# 删除 uploads 目录下的所有文件（递归）
git rm -r --cached public/uploads/**/*

# 或者逐个删除子目录（如果上面的命令不工作）
git rm --cached public/uploads/avatars/*
git rm --cached public/uploads/growth/*
git rm --cached public/uploads/harvest/*
git rm --cached public/uploads/landing/*
git rm --cached public/uploads/misc/*
git rm --cached public/uploads/monthly/*
git rm --cached public/uploads/personnel/*
git rm --cached public/uploads/production/*
git rm --cached public/uploads/products/*
git rm --cached public/uploads/weather/*
```

### 步骤 2: 删除所有媒体文件格式（无论位置）

```bash
# 图片文件
git rm --cached **/*.jpg
git rm --cached **/*.jpeg
git rm --cached **/*.png
git rm --cached **/*.gif
git rm --cached **/*.webp
git rm --cached **/*.avif
git rm --cached **/*.svg
git rm --cached **/*.bmp
git rm --cached **/*.ico
git rm --cached **/*.tiff
git rm --cached **/*.tif

# 视频文件
git rm --cached **/*.mp4
git rm --cached **/*.webm
git rm --cached **/*.ogg
git rm --cached **/*.mov
git rm --cached **/*.avi
git rm --cached **/*.wmv
git rm --cached **/*.flv
git rm --cached **/*.mkv

# 音频文件
git rm --cached **/*.mp3
git rm --cached **/*.wav
git rm --cached **/*.flac
git rm --cached **/*.aac
git rm --cached **/*.m4a
git rm --cached **/*.wma
```

### 步骤 3: 使用通配符批量删除（推荐，更简洁）

如果你使用的是 Git 2.x 或更高版本，可以使用以下命令：

```bash
# 删除所有图片文件
git rm --cached $(git ls-files | grep -E '\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|ico|tiff|tif)$')

# 删除所有视频文件
git rm --cached $(git ls-files | grep -E '\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv)$')

# 删除所有音频文件
git rm --cached $(git ls-files | grep -E '\.(mp3|wav|flac|aac|m4a|wma)$')

# 或者一次性删除所有媒体文件
git rm --cached $(git ls-files | grep -E '\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|ico|tiff|tif|mp4|webm|ogg|mov|avi|wmv|flv|mkv|mp3|wav|flac|aac|m4a|wma)$')
```

### 步骤 4: 验证更改

```bash
# 查看暂存区的更改
git status

# 确认没有媒体文件被暂存
git diff --cached --name-only | grep -E '\.(jpg|jpeg|png|gif|webp|mp4|svg)$'
```

### 步骤 5: 提交更改

```bash
# 提交 .gitignore 和 .gitkeep 文件的更改
git add .gitignore
git add public/uploads/.gitkeep
git add public/uploads/*/.gitkeep

# 提交删除操作
git commit -m "chore: 从 Git 中移除媒体文件和上传目录内容，保留目录结构"
```

## 🔄 Windows PowerShell 用户

如果你使用的是 Windows PowerShell，可能需要使用不同的语法：

```powershell
# 删除所有图片文件
git ls-files | Select-String -Pattern '\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|ico|tiff|tif)$' | ForEach-Object { git rm --cached $_.Line }

# 删除所有视频文件
git ls-files | Select-String -Pattern '\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv)$' | ForEach-Object { git rm --cached $_.Line }

# 删除所有音频文件
git ls-files | Select-String -Pattern '\.(mp3|wav|flac|aac|m4a|wma)$' | ForEach-Object { git rm --cached $_.Line }
```

## ✅ 验证结果

执行完所有命令后，你应该看到：
- ✅ `.gitignore` 已更新
- ✅ `public/uploads/.gitkeep` 和所有子目录的 `.gitkeep` 文件已添加
- ✅ 所有媒体文件已从 Git 暂存区移除（但本地文件仍然存在）
- ✅ `git status` 不再显示这些文件

## 📝 注意事项

1. **本地文件不会删除**：`git rm --cached` 只会从 Git 索引中删除文件，不会删除本地文件系统上的文件。
2. **团队协作**：如果其他团队成员已经拉取了包含这些文件的代码，他们需要执行相同的操作，或者重新克隆仓库。
3. **备份**：虽然文件会保留在本地，但建议在执行前先备份重要文件。

