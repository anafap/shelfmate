using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShelfMate.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class NotificationPreferencesAndDispatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PushDeviceId",
                table: "Sessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "NotificationLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HouseholdId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    InventoryItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpiryDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Offset = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    AttemptedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TicketIds = table.Column<string[]>(type: "text[]", nullable: false),
                    TicketDeviceIds = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    ReceiptsCheckedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationLogs", x => x.Id);
                    table.CheckConstraint("CK_Log_Tickets", "cardinality(\"TicketIds\") = cardinality(\"TicketDeviceIds\")");
                    table.ForeignKey(
                        name: "FK_NotificationLogs_Households_HouseholdId",
                        column: x => x.HouseholdId,
                        principalTable: "Households",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_NotificationLogs_Inventory_InventoryItemId",
                        column: x => x.InventoryItemId,
                        principalTable: "Inventory",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_NotificationLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Preferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    HouseholdId = table.Column<Guid>(type: "uuid", nullable: false),
                    PushEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    InAppEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    DayOffsets = table.Column<int[]>(type: "integer[]", nullable: false),
                    MutedCategoryIds = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    LocalDeliveryTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Preferences", x => x.Id);
                    table.CheckConstraint("CK_Preference_Offsets", "cardinality(\"DayOffsets\") <= 16 AND 0 <= ALL(\"DayOffsets\") AND 365 >= ALL(\"DayOffsets\")");
                    table.ForeignKey(
                        name: "FK_Preferences_Households_HouseholdId",
                        column: x => x.HouseholdId,
                        principalTable: "Households",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Preferences_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PushDevices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Platform = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    LastSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    InvalidatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PushDevices", x => x.Id);
                    table.CheckConstraint("CK_Device_Platform", "\"Platform\" IN ('android', 'ios')");
                    table.ForeignKey(
                        name: "FK_PushDevices_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_PushDeviceId",
                table: "Sessions",
                column: "PushDeviceId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationLogs_HouseholdId",
                table: "NotificationLogs",
                column: "HouseholdId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationLogs_InventoryItemId",
                table: "NotificationLogs",
                column: "InventoryItemId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationLogs_UserId_InventoryItemId_ExpiryDate_Offset",
                table: "NotificationLogs",
                columns: new[] { "UserId", "InventoryItemId", "ExpiryDate", "Offset" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Preferences_HouseholdId",
                table: "Preferences",
                column: "HouseholdId");

            migrationBuilder.CreateIndex(
                name: "IX_Preferences_UserId_HouseholdId",
                table: "Preferences",
                columns: new[] { "UserId", "HouseholdId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PushDevices_Token",
                table: "PushDevices",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PushDevices_UserId",
                table: "PushDevices",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Sessions_PushDevices_PushDeviceId",
                table: "Sessions",
                column: "PushDeviceId",
                principalTable: "PushDevices",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Sessions_PushDevices_PushDeviceId",
                table: "Sessions");

            migrationBuilder.DropTable(
                name: "NotificationLogs");

            migrationBuilder.DropTable(
                name: "Preferences");

            migrationBuilder.DropTable(
                name: "PushDevices");

            migrationBuilder.DropIndex(
                name: "IX_Sessions_PushDeviceId",
                table: "Sessions");

            migrationBuilder.DropColumn(
                name: "PushDeviceId",
                table: "Sessions");
        }
    }
}
