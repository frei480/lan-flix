from tortoise import migrations
from tortoise.migrations import operations as ops
from uuid import uuid4
from tortoise import fields

class Migration(migrations.Migration):
    dependencies = [('models', '0001_initial')]

    initial = False

    operations = [
        ops.CreateModel(
            name='User',
            fields=[
                ('id', fields.UUIDField(primary_key=True, default=uuid4, unique=True, db_index=True)),
                ('username', fields.CharField(unique=True, db_index=True, max_length=150)),
                ('email', fields.CharField(null=True, unique=True, max_length=255)),
                ('hashed_password', fields.CharField(max_length=255)),
                ('disabled', fields.BooleanField(default=False)),
            ],
            options={'table': 'users', 'app': 'models', 'pk_attr': 'id'},
            bases=['Model'],
        ),
    ]
