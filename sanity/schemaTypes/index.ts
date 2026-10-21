import type {SchemaTypeDefinition} from 'sanity'
import {artist} from './artist'
import {blockContent} from './blockContent'
import {resource} from './resource'
import {website} from './website'

export const schemaTypes: SchemaTypeDefinition[] = [website, artist, resource, blockContent]
