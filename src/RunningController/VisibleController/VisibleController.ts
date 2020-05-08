export type VisibleControllerProps = {
    onVisibleChange(status: VisibilityState): void;
};
export const VisibleController = (props: VisibleControllerProps) => {
    const onVisibleChange = () => {
        props.onVisibleChange(document.hidden ? "hidden" : "visible");
    };
    document.addEventListener("visibilitychange", onVisibleChange);
    return () => {
        document.removeEventListener("visibilitychange", onVisibleChange);
    };
};
