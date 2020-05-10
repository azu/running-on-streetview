import pixelmatch from "pixelmatch";

export type activateMotionCameraProps = {
    onTick: ({
        diffs,
        diffPixelCount,
        diffPercent,
    }: {
        diffs: number[];
        diffPixelCount: number;
        diffPercent: number;
    }) => void;
};

const diffMemory: number[] = [];

const median = (sortedNumbers: number[]) => {
    const mid = Math.floor(sortedNumbers.length / 2);
    return sortedNumbers.length % 2 !== 0 ? sortedNumbers[mid] : (sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2;
};

export const activateMotionCamera = (
    {
        videoElement,
    }: {
        mediaStream: MediaStream;
        videoElement: HTMLVideoElement;
    },
    props: activateMotionCameraProps
) => {
    const offscreen = document.createElement("canvas");
    const offscreenCtx = offscreen.getContext("2d");
    if (!offscreenCtx) {
        throw new Error("Can not get offscreenTop canvas");
    }
    videoElement.addEventListener("loadedmetadata", () => {
        offscreen.width = videoElement.width;
        offscreen.height = videoElement.height;
        // document.body.appendChild(offscreen);
        offscreenCtx.drawImage(videoElement, 0, 0, videoElement.width, videoElement.height);
    });
    // 12fps?
    const TICK_BUFFER_COUNT = 12;
    let animationFrameId: number | null = null;
    const tick = () => {
        const videoWidth = videoElement.width;
        const videoHeight = videoElement.height;
        const prevImage = offscreenCtx.getImageData(0, 0, videoWidth, videoHeight);
        offscreenCtx.drawImage(videoElement, 0, 0, videoElement.width, videoElement.height);
        const newImage = offscreenCtx.getImageData(0, 0, videoWidth, videoHeight);
        const diffPixelCount = pixelmatch(prevImage.data, newImage.data, null, videoWidth, videoHeight);
        diffMemory.push(diffPixelCount);
        if (diffMemory.length < TICK_BUFFER_COUNT) {
            requestAnimationFrame(() => tick());
            return;
        }
        const diffCopy = diffMemory.slice().sort();
        const medianDiff = median(diffMemory);
        const diffPercent = (diffPixelCount / newImage.data.length) * 100;
        props.onTick({
            diffs: diffCopy,
            diffPixelCount: medianDiff,
            diffPercent,
        });
        // reset
        diffMemory.length = 0;
        // console.log("diff %i, percent: %s", diff, (diff / newImage.data.length) * 100);
        animationFrameId = requestAnimationFrame(() => tick());
    };
    animationFrameId = requestAnimationFrame(() => tick());
    // https://w3c.github.io/uievents/tools/key-event-viewer.html
    return () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    };
};
