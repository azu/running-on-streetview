import "./ShareButton.css";

export type LoadMapProps = {
    onClick: () => void;
};

export function htmlToElement<T extends HTMLElement>(html: string): T {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content.firstElementChild as T;
}

export type ShareButtonProps = {
    baseUrl?: string;
    mapUrl: string;
};

export const ShareButton = (controlContainer: HTMLElement, props: ShareButtonProps) => {
    const currentUrl = new URL(location.href);
    const baseUrl = props.baseUrl ?? `${currentUrl.origin}${currentUrl.pathname}?defaultMapUrl=`;
    let shareUrl = baseUrl + encodeURIComponent(props.mapUrl);
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
        update(props: Partial<ShareButtonProps>) {
            if (props.mapUrl) {
                shareUrl = baseUrl + encodeURIComponent(props.mapUrl);
            }
        },
        unload() {
            button.removeEventListener("submit", onClick);
        },
    };
};
