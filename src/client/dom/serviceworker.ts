import { ScramjetClient } from "@client/index";
import { type MessageC2W } from "@/worker";
import { flagEnabled } from "@/shared";
import { rewriteUrl } from "@rewriters/url";

// we need a late order because we're mangling with addEventListener at a higher level
export const order = 2;

export const enabled = (client: ScramjetClient) =>
	flagEnabled("serviceworkers", client.url);

export function disabled(client: ScramjetClient, _self: Self) {
	// Don't delete navigator.serviceWorker — PWAs check for it and hang if missing.
	// Instead, stub it so .register() resolves with a no-op registration and
	// .ready resolves immediately. No actual SW is created.

	const fakeWorker = Object.create(ServiceWorker.prototype, {
		scriptURL: { value: "", enumerable: true },
		state: { value: "activated", enumerable: true },
		onstatechange: { value: null, writable: true, enumerable: true },
		postMessage: { value: () => {}, enumerable: true },
		addEventListener: { value: () => {}, enumerable: true },
		removeEventListener: { value: () => {}, enumerable: true },
	});

	// Stub PushManager so registration.pushManager.getSubscription() etc.
	// don't throw "Illegal invocation" (prototype getter needs internal slots).
	const fakePushManager = Object.create(PushManager.prototype);
	Object.defineProperties(fakePushManager, {
		getSubscription: {
			value: () => Promise.resolve(null),
			enumerable: true,
		},
		subscribe: {
			value: () => Promise.reject(new DOMException("Push is not supported in this context", "NotAllowedError")),
			enumerable: true,
		},
	});

	const fakeRegistration: ServiceWorkerRegistration = Object.create(
		ServiceWorkerRegistration.prototype,
		{
			active: { value: fakeWorker, enumerable: true },
			installing: { value: null, enumerable: true },
			waiting: { value: null, enumerable: true },
			scope: { value: client.url.origin + "/", enumerable: true },
			updateViaCache: { value: "none", enumerable: true },
			pushManager: { value: fakePushManager, enumerable: true },
			navigationPreload: {
				value: { enabled: false, enable: () => Promise.resolve(), disable: () => Promise.resolve(), setHeaderValue: () => Promise.resolve(), getState: () => Promise.resolve({ enabled: false, headerValue: "" }) },
				enumerable: true,
			},
			update: {
				value: () => Promise.resolve(fakeRegistration),
				enumerable: true,
			},
			unregister: { value: () => Promise.resolve(true), enumerable: true },
			addEventListener: { value: () => {}, enumerable: true },
			removeEventListener: { value: () => {}, enumerable: true },
			dispatchEvent: { value: () => true, enumerable: true },
		}
	);

	client.Proxy("ServiceWorkerContainer.prototype.register", {
		apply(ctx) {
			ctx.return(Promise.resolve(fakeRegistration));
		},
	});

	client.Proxy("ServiceWorkerContainer.prototype.getRegistration", {
		apply(ctx) {
			ctx.return(Promise.resolve(fakeRegistration));
		},
	});

	client.Proxy("ServiceWorkerContainer.prototype.getRegistrations", {
		apply(ctx) {
			ctx.return(Promise.resolve([fakeRegistration]));
		},
	});

	client.Trap("ServiceWorkerContainer.prototype.ready", {
		get(_ctx) {
			return Promise.resolve(fakeRegistration);
		},
	});

	client.Trap("ServiceWorkerContainer.prototype.controller", {
		get(_ctx) {
			return fakeWorker;
		},
	});
}

type FakeRegistrationState = {
	scope: string;
	active: ServiceWorker;
};

export default function (client: ScramjetClient, _self: Self) {
	const registrationmap: WeakMap<
		ServiceWorkerRegistration,
		FakeRegistrationState
	> = new WeakMap();
	let registration: ServiceWorkerRegistration | undefined;

	client.Proxy("EventTarget.prototype.addEventListener", {
		apply(ctx) {
			if (registrationmap.get(ctx.this)) {
				// do nothing
				ctx.return(undefined);
			}
		},
	});

	client.Proxy("EventTarget.prototype.removeEventListener", {
		apply(ctx) {
			if (registrationmap.get(ctx.this)) {
				// do nothing
				ctx.return(undefined);
			}
		},
	});

	client.Proxy("ServiceWorkerContainer.prototype.getRegistration", {
		apply(ctx) {
			ctx.return(new Promise((resolve) => resolve(registration)));
		},
	});

	client.Proxy("ServiceWorkerContainer.prototype.getRegistrations", {
		apply(ctx) {
			ctx.return(new Promise((resolve) => resolve([registration])));
		},
	});

	client.Trap("ServiceWorkerContainer.prototype.ready", {
		get(_ctx) {
			return new Promise((resolve) => resolve(registration));
		},
	});

	client.Trap("ServiceWorkerContainer.prototype.controller", {
		get(ctx) {
			return registration?.active;
		},
	});

	client.Proxy("ServiceWorkerContainer.prototype.register", {
		apply(ctx) {
			const fakeRegistration = new EventTarget() as ServiceWorkerRegistration;
			Object.setPrototypeOf(
				fakeRegistration,
				self.ServiceWorkerRegistration.prototype
			);
			fakeRegistration.constructor = ctx.fn;
			let url = rewriteUrl(ctx.args[0], client.meta) + "?dest=serviceworker";
			if (ctx.args[1] && ctx.args[1].type === "module") {
				url += "&type=module";
			}

			const worker = client.natives.construct("SharedWorker", url);
			const handle = worker.port;
			const state: FakeRegistrationState = {
				scope: ctx.args[0],
				active: handle as ServiceWorker,
			};
			const controller = client.descriptors.get(
				"ServiceWorkerContainer.prototype.controller",
				client.serviceWorker
			);

			client.natives.call(
				"ServiceWorker.prototype.postMessage",
				controller,
				{
					scramjet$type: "registerServiceWorker",
					port: handle,
					origin: client.url.origin,
				} as MessageC2W,
				[handle]
			);

			registrationmap.set(fakeRegistration, state);
			registration = fakeRegistration;
			ctx.return(new Promise((resolve) => resolve(fakeRegistration)));
		},
	});
}
