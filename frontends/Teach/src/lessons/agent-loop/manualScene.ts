export const FPS = 60;
export const INTRO_FRAMES = 168;
export const STEP_FRAMES = 90;
// 复制/发送短促，输入/生成留出阅读时间，不再每段固定空等三秒。
export const STEP_LENGTHS = [120, 54, 60, 108, 48, 156, 36, 48, 108, 42, 42, 120, 48, 60, 168, 48, 180, 48, 48, 60, 54, 48, 90];
export const STEP_STARTS = STEP_LENGTHS.map((_, index) => STEP_LENGTHS.slice(0, index).reduce((sum, value) => sum + value, 0));
export const STEP_COUNT = STEP_LENGTHS.length;
export const DURATION = STEP_LENGTHS.reduce((sum, value) => sum + value, 0);
export const stepFrame = (step: number, beat = 75) => STEP_STARTS[step]! + Math.ceil(STEP_LENGTHS[step]! * beat / STEP_FRAMES);
const FILE_STEPS = [0, 1, 8, 9, 10, 11, 12, 19, 20, 21, 22];

// 纯状态函数：任何帧均可独立还原，无定时器或累积副作用。
export function manualScene(frame: number) {
  const step = STEP_STARTS.reduce((current, start, index) => frame >= start ? index : current, 0);
  const beat = (frame - STEP_STARTS[step]!) / STEP_LENGTHS[step]! * STEP_FRAMES;
  const latestToast = [1, 7, 10, 12, 18, 21].filter((index) => frame >= stepFrame(index, 35)).at(-1);
  const toastAge = latestToast === undefined ? -1 : frame - stepFrame(latestToast, 35);
  return {
    step, beat, toastAge,
    finalPasted: step > 20 || step === 20 && beat >= 35,
    finalSaved: step > 21 || step === 21 && beat >= 35,
    fileActive: FILE_STEPS.includes(step),
    previousFile: FILE_STEPS.includes(Math.max(0, step - 1)),
    selecting: [0, 8, 11].includes(step),
    pasted: step > 9 || step === 9 && beat >= 35,
    saved: step > 10 || step === 10 && beat >= 35,
    sent: step > 4 || step === 4 && beat >= 42,
    feedbackSent: step > 15 || step === 15 && beat >= 42,
    feedback: step >= 13,
    composing: step === 2 && beat >= 35 || step === 3 || step === 4 && beat < 42 || step === 13 && beat >= 35 || step === 14 || step === 15 && beat < 42,
    generating: step === 5 || step === 16,
    copied: latestToast !== 10 && latestToast !== 21 && toastAge >= 0 && toastAge < FPS * .9,
    saveToast: (latestToast === 10 || latestToast === 21) && toastAge >= 0 && toastAge < FPS * .9,
  };
}
