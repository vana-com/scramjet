// delete all chrome specific apis, or apis that are not supported by any browser other than chrome
// these are not worth emulating and typically cause issues

import { isemulatedsw, iswindow } from "@client/entry";
import { ScramjetClient } from "@client/index";

// type self as any here, most of these are not defined in the types
export default function (client: ScramjetClient, self: any) {
	const del = (name: string) => {
		const split = name.split(".");
		const prop = split.pop();
		const target = split.reduce((a, b) => a?.[b], self);
		if (!target) return;
		if (prop && prop in target) {
			delete target[prop];
		} else {
		}
	};

	// obviously
	// del("chrome");

	// ShapeDetector https://developer.chrome.com/docs/capabilities/shape-detection
	del("BarcodeDetector");
	del("FaceDetector");
	del("TextDetector");

	// background synchronization api
	if (iswindow) {
		del("ServiceWorkerRegistration.prototype.sync");
	}
	if (isemulatedsw) {
		del("SyncManager");
		del("SyncEvent");
	}

	// trustedtypes - delete Chrome-specific constructor types but keep
	// trustedTypes factory so sites using CSP Trusted Types can create policies
	del("TrustedHTML");
	del("TrustedScript");
	del("TrustedScriptURL");
	del("TrustedTypePolicy");
	del("TrustedTypePolicyFactory");

	// whatever this is
	del("Navigator.prototype.joinAdInterestGroup");

	if (!iswindow) return;
	// DOM specific ones below here

	del("MediaDevices.prototype.setCaptureHandleConfig");

	// web bluetooth api
	del("Navigator.prototype.bluetooth");
	del("Bluetooth");
	del("BluetoothDevice");
	del("BluetoothRemoteGATTServer");
	del("BluetoothRemoteGATTCharacteristic");
	del("BluetoothRemoteGATTDescriptor");
	del("BluetoothUUID");

	// contact picker api
	del("Navigator.prototype.contacts");
	del("ContactAddress");
	del("ContactManager");

	// Idle Detection API
	del("IdleDetector");

	// Presentation API
	del("Navigator.prototype.presentation");
	del("Presentation");
	del("PresentationConnection");
	del("PresentationReceiver");
	del("PresentationRequest");
	del("PresentationAvailability");
	del("PresentationConnectionAvailableEvent");
	del("PresentationConnectionCloseEvent");
	del("PresentationConnectionList");

	// Window Controls Overlay API
	del("WindowControlsOverlay");
	del("WindowControlsOverlayGeometryChangeEvent");
	del("Navigator.prototype.windowControlsOverlay");

	// WebHID API
	del("Navigator.prototype.hid");
	del("HID");
	del("HIDDevice");
	del("HIDConnectionEvent");
	del("HIDInputReportEvent");

	// Navigation API - must be deleted because Scramjet doesn't intercept
	// navigation.currentEntry.url, exposing proxied URLs to client code.
	// Frameworks like CanJS that feature-detect it will see broken URLs and
	// fail to route. Deleting forces fallback to window.location (which
	// Scramjet proxies correctly).
	del("navigation");
	del("NavigateEvent");
	del("NavigationActivation");
	del("NavigationCurrentEntryChangeEvent");
	del("NavigationDestination");
	del("NavigationHistoryEntry");
	del("NavigationTransition");
}
