export type VisibleControllerProps = {
    onFullscreenChanged(status: "fullscreen" | "not-fullscreen"): void;
};
export const FullscreenController = (props: VisibleControllerProps) => {
    const onFullScreenChanged = () => {
        props.onFullscreenChanged(document.fullscreenElement ? "fullscreen" : "not-fullscreen");
    };
    document.addEventListener("fullscreenchange", onFullScreenChanged);
    return () => {
        document.removeEventListener("fullscreenchange", onFullScreenChanged);
    };
};
