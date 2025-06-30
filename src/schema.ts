import { createSchema } from 'graphql-yoga'
import { Link, Comment} from '@prisma/client'
import { GraphQLContext } from './context'

const typeDefinitions = `
    type Query {
        info: String!
        feed: [Link!]!
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
        feed: async (parent: unknown, args: {}, context: GraphQLContext) => {
            return context.prisma.link.findMany()
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
            const newLink = await context.prisma.link.create({
                data: {
                    url: args.url,
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
            const newComment = await context.prisma.comment.create({
                data: {
                    body: args.body,
                    linkId: parseInt(args.linkId)
                }
            })

            return newComment
        }
    }
}

export const schema = createSchema({
    resolvers: [resolvers],
    typeDefs: [typeDefinitions]
})