import { createSchema } from 'graphql-yoga'
import { Link } from '@prisma/client'
import { GraphQLContext } from './context'

const typeDefinitions = `
    type Query {
        info: String!
        feed: [Link!]!
    }

    type Mutation {
        postLink(url: String!, description: String!): Link!
    }

    type Link {
        id: ID!
        description: String!
        url: String!
    }
`

const resolvers = {
    Query: {
        info: () => `This is the API of a Hackernews Clone`,
        feed: async (parent: unknown, args: {}, context: GraphQLContext) => {
            return context.prisma.link.findMany()
        }
    },
    Link: {
        id: (parent: Link) => parent.id,
        description: (parent: Link) => parent.description,
        url: (parent: Link) => parent.url
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
        }
    }
}

export const schema = createSchema({
    resolvers: [resolvers],
    typeDefs: [typeDefinitions]
})