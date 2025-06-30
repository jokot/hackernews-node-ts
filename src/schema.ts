import { createSchema } from 'graphql-yoga'
import { Link, Comment} from '@prisma/client'
import { GraphQLContext } from './context'
import { GraphQLError } from 'graphql'
import { Prisma } from '@prisma/client'

const parseIntSafe = (value: string): number | null => {
    if (/^(\d+)$/.test(value)) {
        return parseInt(value, 10)
    }
    return null
}

// URL validation function that accepts both full URLs and domain-only URLs
const validateAndNormalizeUrl = (url: string): string => {
    // Remove leading/trailing whitespace
    const trimmedUrl = url.trim()
    
    // Check if URL already has a protocol
    if (trimmedUrl.match(/^https?:\/\//)) {
        // Full URL with protocol - validate the format
        if (!trimmedUrl.match(/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/)) {
            throw new GraphQLError('Invalid URL format.')
        }
        return trimmedUrl
    } else {
        // Domain-only URL - validate domain format and add https://
        if (!trimmedUrl.match(/^(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/)) {
            throw new GraphQLError('Invalid domain format.')
        }
        return `https://${trimmedUrl}`
    }
}

const applyTakeConstraints = (params: { min: number; max: number; value: number }) => {
    if (params.value < params.min || params.value > params.max) {
        throw new GraphQLError(
            `'take' argument value '${params.value}' is outside the valid range of '${params.min}' to '${params.max}'.`
        )
    }
    return params.value
}

const applySkipConstraints = (params: { value: number }) => {
    if (params.value < 0) {
        throw new GraphQLError(
            `'skip' argument value '${params.value}' should be greater than or equal to 0.`
        )
    }
    return params.value
}

const typeDefinitions = `
    type Query {
        info: String!
        feed(filterNeedle: String, skip: Int, take: Int): [Link!]!
        comment(id: ID!): Comment
        link(id: ID!): Link
    }

    type Mutation {
        postLink(url: String!, description: String!): Link!
        postCommentOnLink(linkId: ID!, body: String!): Comment!
    }

    type Link {
        id: ID!
        description: String!
        url: String!
        comments: [Comment!]!
    }
    
    type Comment {
        id: ID!
        createdAt: String!
        body: String!
        link: Link!
    }
`

const resolvers = {
    Query: {
        info: () => `This is the API of a Hackernews Clone`,
        feed: async (
            parent: unknown, 
            args: { filterNeedle?: string, skip?: number, take?: number },
            context: GraphQLContext
        ) => {
            const where = args.filterNeedle ? {
                OR: [
                    { description: { contains: args.filterNeedle } },
                    { url: { contains: args.filterNeedle } }
                ]
            } : {}

            const take = applyTakeConstraints({
                min: 1, 
                max: 50,
                value: args.take ?? 30
            })
            const skip = applySkipConstraints({
                value: args.skip ?? 0
            })
            return context.prisma.link.findMany({ 
                where,
                skip,
                take
            })
        },
        comment: async (
            parent: unknown, 
            args: { id: string}, 
            context: GraphQLContext
        ) => {
            return context.prisma.comment.findUnique({
                where: {
                    id: parseInt(args.id)
                }
            })
        },
        link: async (
            parent: unknown,
            args : { id: string },
            context : GraphQLContext
        ) => {
            return context.prisma.link.findUnique({
                where: {
                    id: parseInt(args.id)
                }
            })
        }
    },
    Link: {
        id: (parent: Link) => parent.id,
        description: (parent: Link) => parent.description,
        url: (parent: Link) => parent.url,
        comments: (parent: Link, args: {}, context: GraphQLContext) => {
            return context.prisma.comment.findMany({
                orderBy: { createdAt: 'desc' },
                where: {
                    linkId: parent.id
                }
            })
        }
    },
    Comment: {
        id: (parent: Comment) => parent.id,
        createdAt: (parent: Comment) => parent.createdAt,
        body: (parent: Comment) => parent.body,
        link: (parent: Comment, args: {}, context: GraphQLContext) => {
            return context.prisma.link.findUnique({
                where: {
                    id: parent.linkId
                }
            })
        }
    },
    Mutation: {
        async postLink(
            parent: unknown, 
            args: { description: string, url: string },
            context: GraphQLContext
        ) {
            const normalizedUrl = validateAndNormalizeUrl(args.url)
            if (args.description.length === 0) {
                return Promise.reject(
                    new GraphQLError('Cannot post link with empty description.')
                )
            }
            const newLink = await context.prisma.link.create({
                data: {
                    url: normalizedUrl,
                    description: args.description
                }
            })

            return newLink
        },
        async postCommentOnLink(
            parent: unknown,
            args: { linkId: string, body: string },
            context: GraphQLContext
        ) {
            const linkId = parseIntSafe(args.linkId)
            if (linkId === null) {
                return Promise.reject(
                    new GraphQLError(`Cannot post comment on non-existing link with id '${args.linkId}'`)
                )
            }
            if (args.body.length === 0) {
                return Promise.reject(
                    new GraphQLError('Cannot post empty comment.')
                )
            }
            const newComment = await context.prisma.comment
            .create({
                data: {
                    body: args.body,
                    linkId: parseInt(args.linkId)
                }
            })
            .catch((err: unknown) => {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
                    return Promise.reject(
                        new GraphQLError(`Cannot post comment on non-existing link with id '${args.linkId}'.`)
                    )
                }
                return Promise.reject(err)
            })

            return newComment
        }
    }
}

export const schema = createSchema({
    resolvers: [resolvers],
    typeDefs: [typeDefinitions]
})