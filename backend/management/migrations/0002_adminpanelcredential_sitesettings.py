from django.db import migrations, models
import management.models


class Migration(migrations.Migration):

    dependencies = [
        ('management', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AdminPanelCredential',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('password_hash', models.CharField(max_length=256)),
                ('pin_hash', models.CharField(max_length=256)),
                ('question', models.CharField(default='Who are you?', max_length=255)),
                ('answer_hash', models.CharField(max_length=256)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='SiteSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pricing', models.JSONField(default=management.models.default_pricing)),
                ('contact_email', models.CharField(default='setmystay02@gmail.com', max_length=255)),
                ('contact_phone', models.CharField(default='+918210552902', max_length=30)),
                ('contact_address', models.TextField(default='Office no. 01, Neelsidhi Splendour, Sector 15, CBD Belapur, Navi Mumbai, Maharashtra 400614')),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
