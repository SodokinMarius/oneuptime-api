# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("webhooks", "0002_add_team"),
    ]

    operations = [
        migrations.AddField(
            model_name="webhook",
            name="payload_format",
            field=models.CharField(
                choices=[
                    ("json", "JSON (default)"),
                    ("slack", "Slack Incoming Webhook"),
                    ("teams", "Microsoft Teams Connector"),
                ],
                default="json",
                max_length=20,
            ),
        ),
    ]
