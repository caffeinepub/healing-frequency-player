import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Session {
    mood: string;
    frequencyHz: bigint;
    durationSeconds: bigint;
    timestamp: bigint;
}
export interface backendInterface {
    getUserSessions(): Promise<Array<Session>>;
    logSession(mood: string, frequencyHz: bigint, durationSeconds: bigint): Promise<void>;
}
