import { promisify } from 'node:util'
import { pipeline } from 'node:stream'
import { randomUUID } from 'node:crypto'
import { extname, resolve } from 'node:path'
import { createWriteStream, unlink } from 'node:fs'

import { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { prisma } from '../lib/prisma'

const pump = promisify(pipeline)

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/uploads', async (request, reply) => {
    const upload = await request.file({
      limits: {
        fileSize: 20_971_520, // 20mb
      },
    })

    // Verification: is the file present?
    if (!upload?.filename) {
      return reply.status(400).send({
        message:
          'Ocorreu um erro ao receber o arquivo. Selecione a imagem desejada e tente novamente.',
      })
    }

    // Verification: is the file an image?
    const mimeTypeRegex = /^(image)\/[a-zA-Z]+/
    const isValidFileFormat = mimeTypeRegex.test(upload.mimetype)

    if (!isValidFileFormat) {
      return reply.status(400).send({
        message: 'Formato de arquivo inválido. Apenas imagens são aceitas.',
      })
    }

    // Obtaining the original file name to save it
    const fileName = upload.filename

    // Creating a unique file name to store in the disk without conflict
    const fileStoredName = await createUniqueFileName(upload.filename)

    // Storing the file via stream
    const writeStream = createWriteStream(
      resolve(__dirname, '../../uploads', fileStoredName),
    )

    await pump(upload.file, writeStream)

    // Creating path for file access
    const path = await createPath(
      request.protocol,
      request.hostname,
      fileStoredName,
    )

    // Saving entry to the db
    const uploadedFile = await prisma.uploads.create({
      data: {
        Path: path,
        File_Name: fileName,
        File_Stored_Name: fileStoredName,
      },
    })

    return { message: 'Imagem enviada com sucesso', uploadedFile }
  })

  app.get('/uploads', async (request, reply) => {
    const uploads = await prisma.uploads
      .findMany({
        select: {
          Id: true,
          File_Name: true,
          Path: true,
          Created_At: true,
        },
        orderBy: {
          Created_At: 'desc',
        },
      })
      .catch(() =>
        reply
          .status(500)
          .send({ message: 'Erro ao buscar arquivos no banco de dados.' }),
      )

    return uploads.map((upload) => {
      return {
        id: upload.Id,
        path: upload.Path,
        fileName: upload.File_Name,
        createdAt: upload.Created_At,
      }
    })
  })

  app.delete('/uploads/:id', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    })

    const { id } = paramsSchema.parse(request.params)

    // Verification: does file exist?
    const upload = await prisma.uploads
      .findUniqueOrThrow({
        where: {
          Id: id,
        },
      })
      .catch(() => {
        return reply.status(404).send({ message: 'Arquivo não encontrado' })
      })

    const filePath = resolve(
      __dirname,
      '../../uploads',
      upload.File_Stored_Name,
    )

    try {
      // Deleting file from disk
      unlink(filePath, async function (err) {
        if (err) {
          return reply.status(500).send({
            message: `Erro no servidor. ${err}`,
          })
        }

        // Removing entry from DB
        await prisma.uploads.delete({
          where: {
            Id: id,
          },
        })

        return reply
          .status(200)
          .send({ message: 'Arquivo deletado com sucesso.' })
      })
    } catch (err) {
      return reply.status(500).send({
        message: `Erro ao deletar arquivo. ${err}`,
      })
    }
  })
}

async function createUniqueFileName(fileName: string) {
  const fileId = randomUUID()
  const extension = extname(fileName)
  return fileId.concat(extension)
}

async function createPath(
  protocol: string,
  hostName: string,
  fileName: string,
) {
  const domainUrl = protocol.concat('://').concat(hostName)
  return new URL(`/uploads/${fileName}`, domainUrl).toString()
}
