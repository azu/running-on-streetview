const debug = require("debug")("running:LoadMap");
export type LoadMapProps = {
    onSubmit: (url: string) => void;
};
export function htmlToElement<T extends HTMLElement>(html: string): T {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content.firstElementChild as T;
}

export const LoadMap = (controlContainer: HTMLElement, props: LoadMapProps) => {
    const loadMapForm = htmlToElement(`<form class="LoadMap pure-form">
    <fieldset>
        <input id="js-LoadMap-inputURL" type="url" placeholder="Google Map URL" />
        <button type="submit" class="pure-button pure-button-primary">Load Map</button>
    </fieldset>
</form>`);
    const onSubmit = (event: Event) => {
        event.preventDefault();
        const inputURL = loadMapForm.querySelector("#js-LoadMap-inputURL") as HTMLInputElement;
        const url = inputURL.value;
        if (/^https?:/.test(url)) {
            props.onSubmit(url);
        } else {
            debug(`%s is not url`, url);
        }
    };
    loadMapForm.addEventListener("submit", onSubmit);
    controlContainer.appendChild(loadMapForm);
    return () => {
        loadMapForm.removeEventListener("submit", onSubmit);
        controlContainer.removeChild(loadMapForm);
    };
};
