import { describe, expect, it } from "vitest";

import { UI_COPY, optionLabel } from "./ui-copy";

describe("UI_COPY", () => {
  it("uses Chinese copy for the main image generator UI", () => {
    expect(UI_COPY.brand).toBe("图片工具");
    expect(UI_COPY.heroTitle).toBe("图片生成");
    expect(UI_COPY.promptLabel).toBe("提示词");
    expect(UI_COPY.referenceImageLabel).toBe("参考图");
    expect(UI_COPY.referenceImageHint).toBe("点击上传、拖拽或粘贴图片");
    expect(UI_COPY.referenceImageClear).toBe("清除图片");
    expect(UI_COPY.referenceImageSelectedHint).toBe("将按参考图修改");
    expect(UI_COPY.referenceImageInvalidType).toBe("图片格式不支持，请上传 PNG、JPEG、JPG 或 WebP。");
    expect(UI_COPY.referenceImageInvalidSize).toBe("图片不能超过 50 MB。");
    expect(UI_COPY.generateIdle).toBe("生成图片");
    expect(UI_COPY.jobResumeNotice).toBe("正在恢复上一次生成任务，请稍候。");
    expect(UI_COPY.jobRunningStatus).toBe("任务运行中");
    expect(UI_COPY.jobPollingNotice).toBe("图片正在生成中，完成后会自动显示。");
    expect(UI_COPY.jobStartFailed).toBe("启动生成任务失败，请稍后重试。");
    expect(UI_COPY.jobPollingFailed).toBe("暂时无法获取生成进度，请重新提交任务。");
    expect(UI_COPY.downloadPng).toBe("下载 PNG");
    expect(UI_COPY.historyHeading).toBe("历史记录");
    expect(UI_COPY.historySavedCount).toBe("已保存 {count}/50");
    expect(UI_COPY.historyLocalNotice).toBe("历史记录仅保存在本机浏览器。");
    expect(UI_COPY.historyModeGenerate).toBe("文生图");
    expect(UI_COPY.historyModeEdit).toBe("图生图");
    expect(UI_COPY.historyView).toBe("查看");
    expect(UI_COPY.historyDelete).toBe("删除");
    expect(UI_COPY.historyClearAll).toBe("清空全部");
    expect(UI_COPY.editImage).toBe("裁剪/压缩");
    expect(UI_COPY.editorHeading).toBe("裁剪/压缩");
    expect(UI_COPY.editorMatchReferenceRatio).toBe("按参考图比例");
    expect(UI_COPY.editorOutputCrop).toBe("裁剪尺寸");
    expect(UI_COPY.editorOutputReference).toBe("参考图尺寸");
    expect(UI_COPY.editorCropX).toBe("裁剪 X");
    expect(UI_COPY.editorCropWidth).toBe("裁剪宽度");
    expect(UI_COPY.editorFitContain).toBe("完整保留");
    expect(UI_COPY.editorFitCover).toBe("铺满裁剪");
  });

  it("renders Chinese labels for visible option values", () => {
    expect(optionLabel("auto")).toBe("自动");
    expect(optionLabel("high")).toBe("高质量");
    expect(optionLabel("natural")).toBe("自然");
    expect(optionLabel("1024x1536")).toBe("1024 × 1536");
  });
});
