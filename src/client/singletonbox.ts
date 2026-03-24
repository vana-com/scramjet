import { ScramjetClient } from "./client";
import { SourceMaps } from "./shared/sourcemaps";

export class SingletonBox {
	clients: ScramjetClient[] = [];
	globals: Map<Self, ScramjetClient> = new Map();
	clientIds: Map<string, Self> = new Map();
	documents: Map<Document, ScramjetClient> = new Map();
	locations: Map<Location, ScramjetClient> = new Map();

	sourcemaps: SourceMaps = {};

	constructor(public ownerclient: ScramjetClient) {}

	registerClient(client: ScramjetClient, global: Self) {
		this.clients.push(client);
		this.globals.set(global, client);
		this.clientIds.set(client.id, global);
		this.documents.set(global.document, client);
		this.locations.set(global.location, client);
	}
}
