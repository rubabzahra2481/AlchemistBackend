import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateChatTables1734985600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create chat_sessions table
    await queryRunner.createTable(
      new Table({
        name: 'chat_sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'current_profile',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'last_activity',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'message_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'selected_llm',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for chat_sessions
    await queryRunner.createIndex(
      'chat_sessions',
      new TableIndex({
        name: 'idx_chat_sessions_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'chat_sessions',
      new TableIndex({
        name: 'idx_chat_sessions_last_activity',
        columnNames: ['last_activity'],
      }),
    );

    await queryRunner.createIndex(
      'chat_sessions',
      new TableIndex({
        name: 'idx_chat_sessions_created_at',
        columnNames: ['created_at'],
      }),
    );

    // Create chat_messages table
    await queryRunner.createTable(
      new Table({
        name: 'chat_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'session_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'role',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'sequence_number',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'selected_llm',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'reasoning',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'analysis',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'recommendations',
            type: 'text',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'profile_snapshot',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create foreign key constraint
    await queryRunner.createForeignKey(
      'chat_messages',
      new TableForeignKey({
        columnNames: ['session_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'chat_sessions',
        onDelete: 'CASCADE',
        name: 'fk_chat_messages_session_id',
      }),
    );

    // Create indexes for chat_messages
    await queryRunner.createIndex(
      'chat_messages',
      new TableIndex({
        name: 'idx_chat_messages_session_id',
        columnNames: ['session_id'],
      }),
    );

    await queryRunner.createIndex(
      'chat_messages',
      new TableIndex({
        name: 'idx_chat_messages_session_sequence',
        columnNames: ['session_id', 'sequence_number'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'chat_messages',
      new TableIndex({
        name: 'idx_chat_messages_created_at',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createIndex(
      'chat_messages',
      new TableIndex({
        name: 'idx_chat_messages_user_id',
        columnNames: ['user_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key first
    await queryRunner.dropForeignKey('chat_messages', 'fk_chat_messages_session_id');
    
    // Drop indexes
    await queryRunner.dropIndex('chat_messages', 'idx_chat_messages_user_id');
    await queryRunner.dropIndex('chat_messages', 'idx_chat_messages_created_at');
    await queryRunner.dropIndex('chat_messages', 'idx_chat_messages_session_sequence');
    await queryRunner.dropIndex('chat_messages', 'idx_chat_messages_session_id');
    
    await queryRunner.dropIndex('chat_sessions', 'idx_chat_sessions_created_at');
    await queryRunner.dropIndex('chat_sessions', 'idx_chat_sessions_last_activity');
    await queryRunner.dropIndex('chat_sessions', 'idx_chat_sessions_user_id');
    
    // Drop tables
    await queryRunner.dropTable('chat_messages');
    await queryRunner.dropTable('chat_sessions');
  }
}

