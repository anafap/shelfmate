using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShelfMate.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ShoppingChecklist : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Shopping",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HouseholdId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    Quantity = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: true),
                    Unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    PurchasedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    PurchasedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    PurchaseOperationId = table.Column<Guid>(type: "uuid", nullable: true),
                    LinkedInventoryItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Shopping", x => x.Id);
                    table.CheckConstraint("CK_Shopping_Name", "length(btrim(\"Name\")) > 0");
                    table.CheckConstraint("CK_Shopping_Quantity", "\"Quantity\" IS NULL OR (\"Quantity\" > 0 AND \"Quantity\" <= 1000000)");
                    table.CheckConstraint("CK_Shopping_Status", "(\"Status\" = 'ToBuy' AND \"PurchasedBy\" IS NULL AND \"PurchasedAt\" IS NULL AND \"LinkedInventoryItemId\" IS NULL) OR (\"Status\" = 'Purchased' AND \"PurchasedBy\" IS NOT NULL AND \"PurchasedAt\" IS NOT NULL)");
                    table.CheckConstraint("CK_Shopping_Unit", "\"Unit\" IS NULL OR \"Unit\" IN ('piece', 'g', 'kg', 'ml', 'l', 'pack', 'bottle', 'box')");
                    table.ForeignKey(
                        name: "FK_Shopping_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Shopping_Households_HouseholdId",
                        column: x => x.HouseholdId,
                        principalTable: "Households",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Shopping_Inventory_LinkedInventoryItemId",
                        column: x => x.LinkedInventoryItemId,
                        principalTable: "Inventory",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Shopping_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Shopping_Users_PurchasedBy",
                        column: x => x.PurchasedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Shopping_CategoryId",
                table: "Shopping",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Shopping_CreatedBy",
                table: "Shopping",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Shopping_HouseholdId_Status",
                table: "Shopping",
                columns: new[] { "HouseholdId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Shopping_LinkedInventoryItemId",
                table: "Shopping",
                column: "LinkedInventoryItemId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Shopping_PurchasedBy",
                table: "Shopping",
                column: "PurchasedBy");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Shopping");
        }
    }
}
