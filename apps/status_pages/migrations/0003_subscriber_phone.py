# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("status_pages", "0002_add_team"),
    ]

    operations = [
        migrations.AddField(
            model_name="statuspagesubscriber",
            name="phone",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="statuspagesubscriber",
            name="phone_verified",
            field=models.BooleanField(default=False),
        ),
    ]
