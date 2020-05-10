import "./StatusButton.css";

export type LoadMapProps = {
    onClick: () => void;
};

export function htmlToElement<T extends HTMLElement>(html: string): T {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content.firstElementChild as T;
}

export type StatusButtonProps = { onClick(): void; text: string };
export const StatusButton = (controlContainer: HTMLElement, props: StatusButtonProps) => {
    const button = htmlToElement(`<button type="button" class="StatusButton pure-button"/>`);
    const onClick = (event: Event) => {
        event.preventDefault();
        props.onClick();
    };
    button.textContent = `Status: ${props.text}`;
    button.addEventListener("click", onClick);
    controlContainer.appendChild(button);
    return {
        update(props: Partial<StatusButtonProps>) {
            if (props.text) {
                button.textContent = `Status: ${props.text}`;
            }
        },
        unload() {
            button.removeEventListener("submit", onClick);
            controlContainer.removeChild(controlContainer);
        },
    };
};
