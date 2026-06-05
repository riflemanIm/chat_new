import { PrismaClient, ChatMemberRole, ChatType, MessageStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const [alice, bob, charlie] = await Promise.all(
    [
      { email: 'alice@example.com', username: 'alice', displayName: 'Alice' },
      { email: 'bob@example.com', username: 'bob', displayName: 'Bob' },
      { email: 'charlie@example.com', username: 'charlie', displayName: 'Charlie' },
    ].map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: { ...user, passwordHash },
      }),
    ),
  );

  const group = await prisma.chat.create({
    data: {
      type: ChatType.GROUP,
      title: 'Demo group',
      createdBy: alice.id,
      members: {
        create: [
          { userId: alice.id, role: ChatMemberRole.OWNER },
          { userId: bob.id, role: ChatMemberRole.MEMBER },
          { userId: charlie.id, role: ChatMemberRole.MEMBER },
        ],
      },
    },
  });

  const message = await prisma.message.create({
    data: {
      chatId: group.id,
      senderId: alice.id,
      text: 'Hello from seed data',
      statuses: {
        create: [
          { userId: alice.id, status: MessageStatus.READ },
          { userId: bob.id, status: MessageStatus.SENT },
          { userId: charlie.id, status: MessageStatus.SENT },
        ],
      },
    },
  });

  console.log({ users: [alice.email, bob.email, charlie.email], group: group.id, message: message.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
