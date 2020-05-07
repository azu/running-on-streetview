export type activateKeyboardProps = {
    onLeft: () => void;
    onRight: () => void;
    onUp: () => void;
    onDown: () => void;
};
export const activateKeyboard = (target: HTMLElement, props: activateKeyboardProps) => {
    console.log(target, "active ");
    // https://w3c.github.io/uievents/tools/key-event-viewer.html
    const onKeyUp = (event: KeyboardEvent) => {
        const keyName = event.key;
        console.log("keyName", keyName);
        switch (keyName) {
            case "ArrowLeft":
                return props.onLeft();
            case "ArrowRight":
                return props.onRight();
            case "ArrowUp":
                return props.onUp();
            case "ArrowDown":
                return props.onDown();
            default:
                return;
        }
    };
    target.addEventListener("keyup", onKeyUp);
    return () => {
        target.removeEventListener("keyup", onKeyUp);
    };
};
