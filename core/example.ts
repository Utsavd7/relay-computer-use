import { ArtifactSchema } from './schema';
import recorded from '../evidence/capability.json';
/** The bundled example is the artifact emitted by the genuine local-model discovery. */
export const exampleArtifact = ArtifactSchema.parse(recorded);
