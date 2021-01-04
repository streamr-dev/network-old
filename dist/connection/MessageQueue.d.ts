declare type Info = Object;
export declare class QueueItem<M> {
    private static nextNumber;
    private readonly message;
    private readonly onSuccess;
    private readonly onError;
    private readonly infos;
    readonly no: number;
    private tries;
    private failed;
    constructor(message: M, onSuccess: () => void, onError: (err: Error) => void);
    getMessage(): M;
    getInfos(): ReadonlyArray<Info>;
    isFailed(): boolean;
    delivered(): void;
    incrementTries(info: Info): void | never;
    immediateFail(errMsg: string): void;
}
export declare class MessageQueue<M> {
    static readonly MAX_TRIES = 10;
    private readonly heap;
    private readonly maxSize;
    constructor(maxSize?: number);
    add(message: M): Promise<void>;
    peek(): QueueItem<M>;
    pop(): QueueItem<M>;
    size(): number;
    empty(): boolean;
}
export {};
