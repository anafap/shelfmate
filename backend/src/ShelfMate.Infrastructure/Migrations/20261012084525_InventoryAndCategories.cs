using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ShelfMate.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InventoryAndCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Key = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IsSystemDefined = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HouseholdId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    Unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PurchaseDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ExpiryDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ExpiryType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StorageLocation = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ReminderEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory", x => x.Id);
                    table.CheckConstraint("CK_Inventory_Dates", "(\"ExpiryDate\" IS NULL OR \"ExpiryDate\" BETWEEN DATE '1900-01-01' AND DATE '2100-12-31') AND (\"PurchaseDate\" IS NULL OR \"PurchaseDate\" BETWEEN DATE '1900-01-01' AND DATE '2100-12-31')");
                    table.CheckConstraint("CK_Inventory_Expiry", "(\"ExpiryDate\" IS NULL AND \"ExpiryType\" = 'Unknown') OR (\"ExpiryDate\" IS NOT NULL AND \"ExpiryType\" IN ('Printed', 'Estimated'))");
                    table.CheckConstraint("CK_Inventory_Name", "length(btrim(\"Name\")) > 0");
                    table.CheckConstraint("CK_Inventory_Quantity", "\"Quantity\" > 0 AND \"Quantity\" <= 1000000");
                    table.CheckConstraint("CK_Inventory_Reminders", "\"Status\" = 'Active' OR NOT \"ReminderEnabled\"");
                    table.CheckConstraint("CK_Inventory_Status", "\"Status\" IN ('Active', 'Consumed', 'Discarded')");
                    table.CheckConstraint("CK_Inventory_Unit", "\"Unit\" IN ('piece', 'g', 'kg', 'ml', 'l', 'pack', 'bottle', 'box')");
                    table.ForeignKey(
                        name: "FK_Inventory_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_Households_HouseholdId",
                        column: x => x.HouseholdId,
                        principalTable: "Households",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_Users_UpdatedBy",
                        column: x => x.UpdatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "Categories",
                columns: new[] { "Id", "IsSystemDefined", "Key", "Name" },
                values: new object[,]
                {
                    { new Guid("00000000-0000-4000-8000-000000000001"), true, "fruits", "Fruits" },
                    { new Guid("00000000-0000-4000-8000-000000000002"), true, "vegetables", "Vegetables" },
                    { new Guid("00000000-0000-4000-8000-000000000003"), true, "dairy", "Dairy" },
                    { new Guid("00000000-0000-4000-8000-000000000004"), true, "meat", "Meat & Poultry" },
                    { new Guid("00000000-0000-4000-8000-000000000005"), true, "seafood", "Seafood" },
                    { new Guid("00000000-0000-4000-8000-000000000006"), true, "frozen", "Frozen Food" },
                    { new Guid("00000000-0000-4000-8000-000000000007"), true, "pantry", "Pantry & Canned" },
                    { new Guid("00000000-0000-4000-8000-000000000008"), true, "bakery", "Bakery" },
                    { new Guid("00000000-0000-4000-8000-000000000009"), true, "beverages", "Beverages" },
                    { new Guid("00000000-0000-4000-8000-000000000010"), true, "medicines", "Medicines" },
                    { new Guid("00000000-0000-4000-8000-000000000011"), true, "household", "Household Essentials" },
                    { new Guid("00000000-0000-4000-8000-000000000012"), true, "other", "Other" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Key",
                table: "Categories",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_CategoryId",
                table: "Inventory",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_CreatedBy",
                table: "Inventory",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_HouseholdId_Status_ExpiryDate",
                table: "Inventory",
                columns: new[] { "HouseholdId", "Status", "ExpiryDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_UpdatedBy",
                table: "Inventory",
                column: "UpdatedBy");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Inventory");

            migrationBuilder.DropTable(
                name: "Categories");
        }
    }
}
