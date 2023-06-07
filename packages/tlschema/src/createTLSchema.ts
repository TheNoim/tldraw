import { Migrations, StoreSchema, createRecordType, defineMigrations } from '@tldraw/store'
import { T } from '@tldraw/validate'
import { TLStoreProps, createIntegrityChecker, onValidationFailure } from './TLStore'
import { AssetRecordType } from './records/TLAsset'
import { CameraRecordType } from './records/TLCamera'
import { DocumentRecordType } from './records/TLDocument'
import { InstanceRecordType } from './records/TLInstance'
import { PageRecordType } from './records/TLPage'
import { InstancePageStateRecordType } from './records/TLPageState'
import { PointerRecordType } from './records/TLPointer'
import { InstancePresenceRecordType } from './records/TLPresence'
import { TLRecord } from './records/TLRecord'
import { TLShape, rootShapeMigrations } from './records/TLShape'
import { embedShapeMigrations, embedShapeTypeValidator } from './shapes/TLEmbedShape'
import { groupShapeMigrations, groupShapeValidator } from './shapes/TLGroupShape'
import { imageShapeMigrations, imageShapeValidator } from './shapes/TLImageShape'
import { videoShapeMigrations, videoShapeValidator } from './shapes/TLVideoShape'
import { storeMigrations } from './store-migrations'

/** @public */
export type SchemaShapeInfo = {
	migrations?: Migrations
	validator?: { validate: (record: any) => any }
}

const coreShapes: Record<string, SchemaShapeInfo> = {
	group: {
		migrations: groupShapeMigrations,
		validator: groupShapeValidator,
	},
	embed: {
		migrations: embedShapeMigrations,
		validator: embedShapeTypeValidator,
	},
	image: {
		migrations: imageShapeMigrations,
		validator: imageShapeValidator,
	},
	video: {
		migrations: videoShapeMigrations,
		validator: videoShapeValidator,
	},
}

/**
 * Create a TLSchema with custom shapes. Custom shapes cannot override default shapes.
 *
 * @param opts - Options
 *
 * @public */
export function createTLSchema(
	opts = {} as {
		customShapes: Record<string, SchemaShapeInfo>
	}
) {
	const { customShapes } = opts

	for (const key in customShapes) {
		if (key in coreShapes) {
			throw Error(`Can't override default shape ${key}!`)
		}
	}

	const allShapeEntries = Object.entries({ ...coreShapes, ...customShapes })

	const ShapeRecordType = createRecordType<TLShape>('shape', {
		migrations: defineMigrations({
			currentVersion: rootShapeMigrations.currentVersion,
			firstVersion: rootShapeMigrations.firstVersion,
			migrators: rootShapeMigrations.migrators,
			subTypeKey: 'type',
			subTypeMigrations: {
				...Object.fromEntries(
					allShapeEntries.map(([k, v]) => [k, v.migrations ?? defineMigrations({})])
				),
			},
		}),
		scope: 'document',
		validator: T.model(
			'shape',
			T.union('type', {
				...Object.fromEntries(
					allShapeEntries.map(([k, v]) => [k, (v.validator as T.Validator<any>) ?? T.any])
				),
			})
		),
	}).withDefaultProperties(() => ({ x: 0, y: 0, rotation: 0, isLocked: false, opacity: 1 }))

	return StoreSchema.create<TLRecord, TLStoreProps>(
		{
			asset: AssetRecordType,
			camera: CameraRecordType,
			document: DocumentRecordType,
			instance: InstanceRecordType,
			instance_page_state: InstancePageStateRecordType,
			page: PageRecordType,
			shape: ShapeRecordType,
			instance_presence: InstancePresenceRecordType,
			pointer: PointerRecordType,
		},
		{
			snapshotMigrations: storeMigrations,
			onValidationFailure,
			createIntegrityChecker: createIntegrityChecker,
		}
	)
}
