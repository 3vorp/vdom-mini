export interface State<T> {
	readonly type: "state";
	value: T;
}

export interface Computed<T> {
	readonly type: "computed";
	readonly value: T;
}

export function reactive<T extends (...args: any[]) => any>(val: T): Computed<ReturnType<T>>;
export function reactive<T>(val: T): State<T>;

export interface VNode {
	tag: string;
	props: Record<string, any>;
	children: (VNode | string)[];
}

export type AcceptedChild = VNode | string | false | null;

export interface VirtualDOMOptions {
	el?: string;
	state?: ($: typeof reactive) => Record<string, any>;
	view: (
		this: Record<string, any>,
		h: (
			tag: string,
			props?: Record<string, any>,
			children?: AcceptedChild[] | AcceptedChild,
		) => VNode,
	) => VNode;
	created?: (this: Record<string, any>) => void;
	mounted?: (this: Record<string, any>) => void;
	updated?: (this: Record<string, any>) => void;
	watch?: Record<string, (this: Record<string, any>, newValue: unknown) => void>;
	data?: () => Record<string, any>;
	methods?: Record<string, (this: Record<string, any>,) => any>;
	computed?: Record<string, (this: Record<string, any>,) => any>;
}

export default class VirtualDOM {
	constructor(options: VirtualDOMOptions);
	mount(sel?: string): this;
}
