import LatLngLiteral = google.maps.LatLngLiteral;
import { openDB } from "idb";

export type DBSchema = {
    "location-tracker": {
        timestamp: number;
        position: LatLngLiteral;
    };
};
export const createLocationTracker = async () => {
    const db = await openDB<DBSchema>("running-on-streetview", 1, {
        upgrade(db) {
            // Create a store of objects
            const store = db.createObjectStore("location-tracker", {
                // The 'id' property of the object will be the key.
                keyPath: "id",
                // If it isn't explicitly set, create a value by auto incrementing.
                autoIncrement: true,
            });
            // Create an index on the 'date' property of the objects.
            store.createIndex("timestamp", "timestamp");
        },
    });
    return {
        add({ position, timestamp }: { position: LatLngLiteral; timestamp: number }) {
            return db.add("location-tracker", {
                position,
                timestamp,
            });
        },
        count() {
            return db.count("location-tracker");
        },
    };
};
