import "./ShareButton.css";
export type LoadMapProps = {
    onClick: () => void;
};

export function htmlToElement<T extends HTMLElement>(html: string): T {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content.firstElementChild as T;
}

export const ShareButton = (controlContainer: HTMLElement) => {
    let shareUrl = "";
    const button = htmlToElement(`<button class="ShareButton pure-button">Tweet your running location</button>`);
    const onClick = (event: Event) => {
        event.preventDefault();
        const twitter = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            shareUrl
        )}&hashtags=RunningOnStreetView`;
        window.open(twitter, "_blank");
    };
    button.addEventListener("click", onClick);
    controlContainer.appendChild(button);
    return {
        setMapURL(url: string) {
            shareUrl = url;
        },
        unload() {
            button.removeEventListener("submit", onClick);
        },
    };
};
