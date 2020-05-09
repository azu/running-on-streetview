export const globalState = {
    start: false,
    trial: false,
    get googleMapAPIKey() {
        return localStorage.getItem("running-googleMapAPIKey") ?? undefined;
    },
    set googleMapAPIKey(value: string | undefined) {
        if (value) {
            localStorage.setItem("running-googleMapAPIKey", value);
        }
    },
};
