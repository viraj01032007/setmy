from django.contrib.auth.hashers import check_password
from django.db import migrations

LEAKED = 'Admin@12345'  # was written in the public code; any account still using it gets locked


def lock_leaked_passwords(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    for user in User.objects.filter(is_superuser=True):
        if user.password and check_password(LEAKED, user.password):
            user.password = '!locked-leaked-password'  # unusable password
            user.save(update_fields=['password'])


class Migration(migrations.Migration):

    dependencies = [
        ('management', '0002_adminpanelcredential_sitesettings'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(lock_leaked_passwords, migrations.RunPython.noop),
    ]
