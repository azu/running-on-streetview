export const TRIAL_KEY = "AIzaSyCHT-d9KNsSTGuoNyNsLHnUlTQ4RifkEK0";
export const globalState = {
    start: false,
    get trial() {
        return TRIAL_KEY === this.googleMapAPIKey;
    },
    get googleMapAPIKey() {
        return localStorage.getItem("running-googleMapAPIKey") ?? undefined;
    },
    set googleMapAPIKey(value: string | undefined) {
        if (value) {
            localStorage.setItem("running-googleMapAPIKey", value);
        }
    },
};
