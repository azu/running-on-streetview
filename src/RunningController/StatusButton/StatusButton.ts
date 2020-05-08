import "./StatusButton.css";
export type LoadMapProps = {
    onClick: () => void;
};

export function htmlToElement<T extends HTMLElement>(html: string): T {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content.firstElementChild as T;
}

export const StatusButton = (controlContainer: HTMLElement, props: { onClick(): void; defaultText: string }) => {
    const button = htmlToElement(`<button type="button" class="StatusButton pure-button"/>`);
    const onClick = (event: Event) => {
        event.preventDefault();
        props.onClick();
    };
    button.textContent = `Status: ${props.defaultText}`;
    button.addEventListener("click", onClick);
    controlContainer.appendChild(button);
    return {
        setText(text: string) {
            button.textContent = `Status: ${text}`;
        },
        unload() {
            button.removeEventListener("submit", onClick);
            controlContainer.removeChild(controlContainer);
        },
    };
};
